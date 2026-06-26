// Núcleo de cálculo: progresión y prognosis. Funciones puras, sin I/O — quien las
// llama (Prompt 1.4) es responsable de leer/escribir Supabase/Dexie.

import { resolveAvailableLoads, snapLoad, type EquipmentLoadConfig } from "./loads";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export type SnappedLoad = { ideal: number; real: number; delta: number };

export function targetLoad(e1rm: number, pctMax: number, equipment: EquipmentLoadConfig): SnappedLoad {
  const ideal = e1rm * (pctMax / 100);
  const snap = snapLoad(ideal, equipment, "down");
  return { ideal, real: snap.real, delta: snap.delta };
}

export type SetResult = { load: number; reps: number; rpe: number };

// Estimación de e1RM por RPE (RIR = reps en reserva). Epley sobre reps-a-fallo
// estimadas, no sobre las reps reportadas directamente. Punto de extensión: para
// cambiar a una tabla RPE×reps→%1RM (Helms/RTS), basta reemplazar el cuerpo de
// esta función — la firma (SetResult) => number no cambia.
export function e1rmFromSet({ load, reps, rpe }: SetResult): number {
  const rir = clamp(10 - rpe, 0, 10);
  const repsToFailure = reps + rir;
  return load * (1 + repsToFailure / 30);
}

export type ExerciseE1rm = { e1rm_kg: number | null };

export type UpdateE1rmResult = {
  e1rm: number;
  updated: boolean;
  bestSetE1rm: number;
};

// Tras una sesión: toma la mejor serie efectiva y, si supera al e1RM actual, lo
// sube — pero nunca más de maxIncreasePct por sesión, para no perseguir un
// outlier puntual. El registro de la fila en e1rm_estimates es responsabilidad
// del caller (Prompt 1.4), no de esta función pura.
export function updateE1rm(
  exercise: ExerciseE1rm,
  sessionSets: SetResult[],
  options: { maxIncreasePct?: number } = {}
): UpdateE1rmResult {
  const maxIncreasePct = options.maxIncreasePct ?? 8;
  const current = exercise.e1rm_kg ?? 0;

  if (sessionSets.length === 0) {
    return { e1rm: current, updated: false, bestSetE1rm: current };
  }

  const bestSetE1rm = Math.max(...sessionSets.map(e1rmFromSet));
  if (bestSetE1rm <= current) {
    return { e1rm: current, updated: false, bestSetE1rm };
  }

  const e1rm = current === 0 ? bestSetE1rm : Math.min(bestSetE1rm, current * (1 + maxIncreasePct / 100));
  return { e1rm, updated: true, bestSetE1rm };
}

export type SuggestNextLoadInput = {
  target_reps: number;
  target_rpe: number;
  last_session_sets: SetResult[];
};

export type LoadSuggestionAction = "increase" | "maintain" | "repeat" | "decrease";

export type LoadSuggestion = SnappedLoad & {
  action: LoadSuggestionAction;
  reason: string;
};

// Tres caminos (el tercero con dos variantes, repetir o bajar, según qué tan
// corto se quedó):
// 1) cumplió reps con RPE <= objetivo            -> increase
// 2) cumplió reps pero con RPE > objetivo         -> maintain
// 3) no cumplió reps (o RPE a fallo)              -> repeat | decrease
export function suggestNextLoad(input: SuggestNextLoadInput, equipment: EquipmentLoadConfig): LoadSuggestion {
  const { target_reps, target_rpe, last_session_sets } = input;
  if (last_session_sets.length === 0) {
    throw new Error("suggestNextLoad necesita al menos una serie de la sesión anterior");
  }

  const lastLoad = last_session_sets[last_session_sets.length - 1].load;
  const minReps = Math.min(...last_session_sets.map((s) => s.reps));
  const maxRpe = Math.max(...last_session_sets.map((s) => s.rpe));
  const metReps = minReps >= target_reps;

  const available = resolveAvailableLoads(equipment);

  function snapped(ideal: number): SnappedLoad {
    if (available.length === 0) {
      // Sin equipo/carga concreta: no hay escalón real para snappear (ej. e1RM
      // sin equipo asociado). Se sugiere el ideal tal cual, sin redondeo.
      return { ideal, real: ideal, delta: 0 };
    }
    const snap = snapLoad(ideal, equipment, "nearest");
    return { ideal, real: snap.real, delta: snap.delta };
  }

  if (metReps && maxRpe <= target_rpe) {
    const stepIdx = available.findIndex((l) => l > lastLoad);
    const reason = `Cumpliste ${target_reps}+ reps con RPE ${maxRpe} (objetivo ${target_rpe}): subí al próximo escalón.`;
    if (stepIdx === -1) {
      // No hay escalón disponible por encima de la carga actual (tope del
      // equipo): la sugerencia es +e1RM, no snappeada a una grilla que ya no
      // tiene margen.
      const ideal = lastLoad * 1.025;
      return { action: "increase", ideal, real: ideal, delta: 0, reason };
    }
    return { ...snapped(available[stepIdx]), action: "increase", reason };
  }

  if (metReps && maxRpe > target_rpe) {
    return {
      ...snapped(lastLoad),
      action: "maintain",
      reason: `Cumpliste las reps pero con RPE ${maxRpe}, por encima del objetivo ${target_rpe}: mantené la carga.`,
    };
  }

  const repsShortfall = target_reps - minReps;
  if (repsShortfall <= 1 && maxRpe < 10) {
    return {
      ...snapped(lastLoad),
      action: "repeat",
      reason: `Te faltó ${repsShortfall} rep(s) para el objetivo: repetí la misma carga la próxima vez.`,
    };
  }

  const stepsDown = available.filter((l) => l < lastLoad);
  const nextDown = stepsDown.length > 0 ? stepsDown[stepsDown.length - 1] : lastLoad * 0.95;
  return {
    ...snapped(nextDown),
    action: "decrease",
    reason: `Quedaste lejos del objetivo de reps (RPE ${maxRpe}): bajá un escalón.`,
  };
}

export type NonLoadSuggestion = { target: number; isPR: boolean };

// Para ejercicios sin carga (seconds/meters/intervals/reps): no hay e1RM ni
// equipo que snappear, la progresión es batir el mejor registro histórico.
// `history` son los valores en orden cronológico (el último es la sesión más
// reciente).
export function suggestNextTarget(history: number[]): NonLoadSuggestion {
  if (history.length === 0) return { target: 0, isPR: false };

  const last = history[history.length - 1];
  const previousBest = history.length > 1 ? Math.max(...history.slice(0, -1)) : -Infinity;
  const isPR = last > previousBest;

  return { target: Math.max(last, previousBest === -Infinity ? last : previousBest), isPR };
}
