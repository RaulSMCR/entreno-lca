// Marco teórico mínimo (T-1): no existía en el repo (verificado contra
// prompts_claude_code_entrenamiento.md y git log --all — nunca se ejecutó). Se
// deriva de los datos reales del slot (reps/pct_max) y de la unidad del
// ejercicio, ya que template_slots no tiene un campo "objective" explícito.

export type TrainingObjective = "strength" | "power" | "hypertrophy" | "endurance";

export type SlotForObjective = {
  reps?: number | null;
  pct_max?: number | null;
};

// Heurística documentada y reemplazable: ejercicios sin carga (unit !== 'kg')
// son de resistencia/tiempo; para los de carga, reps bajas + %max alto es
// fuerza, reps bajas + %max moderado es potencia (movimiento explosivo con
// menos carga relativa), reps medias es hipertrofia, reps altas es resistencia.
export function getObjectiveFromSlot(
  slot: SlotForObjective,
  exerciseUnit?: string | null
): TrainingObjective {
  if (exerciseUnit && exerciseUnit !== "kg") return "endurance";

  const reps = slot.reps ?? 10;
  const pctMax = slot.pct_max ?? null;

  if (reps <= 5 && (pctMax == null || pctMax >= 80)) return "strength";
  if (reps <= 6 && pctMax != null && pctMax < 80) return "power";
  if (reps <= 12) return "hypertrophy";
  return "endurance";
}

export type RestPrescription = { min: number; recommended: number; max: number };

export const PRESCRIBED_REST_SECONDS: Record<TrainingObjective, RestPrescription> = {
  strength: { min: 120, recommended: 180, max: 300 },
  power: { min: 120, recommended: 150, max: 240 },
  hypertrophy: { min: 60, recommended: 90, max: 120 },
  endurance: { min: 30, recommended: 45, max: 60 },
};

export type Tempo = { eccentric: number; pause: number; concentric: number };

export const TEMPO_BY_OBJECTIVE: Record<TrainingObjective, Tempo> = {
  strength: { eccentric: 3, pause: 1, concentric: 1 },
  power: { eccentric: 2, pause: 0, concentric: 1 },
  hypertrophy: { eccentric: 3, pause: 1, concentric: 2 },
  endurance: { eccentric: 1, pause: 0, concentric: 1 },
};

// Duración de cada "beat" del countdown previo a una serie (3 beats: "3, 2, 1").
export const BEAT_SECONDS_BY_OBJECTIVE: Record<TrainingObjective, number> = {
  strength: 4,
  power: 3,
  hypertrophy: 3,
  endurance: 2,
};

// Tiempo bajo tensión total: sets * reps * (duración de tempo por rep).
export function estimateTUTSeconds(sets: number, reps: number, objective: TrainingObjective): number {
  const tempo = TEMPO_BY_OBJECTIVE[objective];
  const perRep = tempo.eccentric + tempo.pause + tempo.concentric;
  return sets * reps * perRep;
}
