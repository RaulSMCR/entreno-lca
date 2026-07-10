// Protocolo NSCA de 1RM directo (U-2 Parte B): solo para los 3 ejercicios con
// protocol = 'direct_1rm' (lib/calibration.ts). Funciones puras, sin I/O —
// reutiliza targetLoad de lib/engine.ts para no duplicar la lógica de snap a
// cargas reales del equipo.

import { targetLoad, type SnappedLoad } from "./engine";
import type { EquipmentLoadConfig } from "./loads";

export type ProtocolPhaseKind = "warmup" | "attempt";

export type ProtocolPhase = {
  kind: ProtocolPhaseKind;
  phaseNumber: number;
  pctOfE1rm: number;
  targetLoadKg: number;
  reps: number;
  restSeconds: number;
};

export type ProtocolAttempt = {
  pctOfE1rm: number;
  loadKg: number;
  success: boolean;
};

export type BuildProtocolPhasesCtx = {
  exercise: { name: string };
  current_e1rm_kg: number;
  equipment?: EquipmentLoadConfig;
};

const WARMUP_STEPS = [
  { pct: 50, reps: 8, restSeconds: 60 },
  { pct: 70, reps: 5, restSeconds: 120 },
  { pct: 85, reps: 2, restSeconds: 180 },
];

// Punto medio del rango 93-95% que especifica el protocolo NSCA para el primer
// intento de 1 rep.
const FIRST_ATTEMPT_PCT = 94;
const ATTEMPT_REST_SECONDS = 240;
const SUCCESS_STEP_PCT = 5;
const FAIL_STEP_PCT = -2.5;

const MAX_SUCCESSES = 3;
const MAX_SAME_WEIGHT_FAILURES = 2;
const MAX_TOTAL_ATTEMPTS = 5;

function resolveLoad(e1rm: number, pct: number, equipment?: EquipmentLoadConfig): number {
  if (!equipment) return Math.round(e1rm * (pct / 100) * 10) / 10;
  const snapped: SnappedLoad = targetLoad(e1rm, pct, equipment);
  return snapped.real;
}

// Fases 1-3 (calentamiento fijo) + fase 4 (primer intento). Los intentos
// siguientes (fase 5+) dependen del resultado del anterior y se obtienen con
// getNextAttempt — no se pueden precalcular todos de antemano.
export function buildProtocolPhases(ctx: BuildProtocolPhasesCtx): ProtocolPhase[] {
  const e1rm = ctx.current_e1rm_kg;

  const warmupPhases: ProtocolPhase[] = WARMUP_STEPS.map((step, i) => ({
    kind: "warmup",
    phaseNumber: i + 1,
    pctOfE1rm: step.pct,
    targetLoadKg: resolveLoad(e1rm, step.pct, ctx.equipment),
    reps: step.reps,
    restSeconds: step.restSeconds,
  }));

  const firstAttempt: ProtocolPhase = {
    kind: "attempt",
    phaseNumber: 4,
    pctOfE1rm: FIRST_ATTEMPT_PCT,
    targetLoadKg: resolveLoad(e1rm, FIRST_ATTEMPT_PCT, ctx.equipment),
    reps: 1,
    restSeconds: ATTEMPT_REST_SECONDS,
  };

  return [...warmupPhases, firstAttempt];
}

export type NextAttemptResult =
  | { done: true; reason: "three_successes" | "same_weight_failed_twice" | "max_attempts_reached" }
  | { done: false; attempt: ProtocolPhase };

// Se llama después de registrar cada intento (LOGRADO/FALLIDO) para saber si hay
// que seguir y con qué carga. "mismo peso fallado 2 veces" se chequea sobre la
// carga REAL ya snappeada al equipo, no sobre el % ideal: con equipos de barra +
// discos, un -2.5% puede redondear a la misma carga real que el intento anterior
// (el paso de disco disponible es más grueso que 2.5%), y eso cuenta como repetir
// el mismo peso.
export function getNextAttempt(
  attempts: ProtocolAttempt[],
  ctx: BuildProtocolPhasesCtx
): NextAttemptResult {
  const successCount = attempts.filter((a) => a.success).length;
  if (successCount >= MAX_SUCCESSES) return { done: true, reason: "three_successes" };

  const failedLoadCounts = new Map<number, number>();
  for (const a of attempts) {
    if (!a.success) failedLoadCounts.set(a.loadKg, (failedLoadCounts.get(a.loadKg) ?? 0) + 1);
  }
  if ([...failedLoadCounts.values()].some((count) => count >= MAX_SAME_WEIGHT_FAILURES)) {
    return { done: true, reason: "same_weight_failed_twice" };
  }

  if (attempts.length >= MAX_TOTAL_ATTEMPTS) return { done: true, reason: "max_attempts_reached" };

  const last = attempts[attempts.length - 1];
  const e1rm = ctx.current_e1rm_kg;
  const nextPct = last ? last.pctOfE1rm + (last.success ? SUCCESS_STEP_PCT : FAIL_STEP_PCT) : FIRST_ATTEMPT_PCT;

  return {
    done: false,
    attempt: {
      kind: "attempt",
      phaseNumber: 4 + attempts.length,
      pctOfE1rm: nextPct,
      targetLoadKg: resolveLoad(e1rm, nextPct, ctx.equipment),
      reps: 1,
      restSeconds: ATTEMPT_REST_SECONDS,
    },
  };
}

// Mayor carga levantada con éxito; null si ningún intento tuvo éxito (el
// protocolo no determinó un e1RM ese día — se mantiene el valor previo).
export function getDeterminedE1RM(attempts: ProtocolAttempt[]): number | null {
  const successful = attempts.filter((a) => a.success);
  if (successful.length === 0) return null;
  return Math.max(...successful.map((a) => a.loadKg));
}
