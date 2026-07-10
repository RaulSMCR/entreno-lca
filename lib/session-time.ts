// R-1: motor de estimación de duración de sesión. Funciones puras — igual que
// lib/engine.ts, sin I/O. Usa lib/training-theory.ts (T-1) para inferir el
// objetivo de cada slot y sus tiempos prescritos.

import type { LocalEquipment, LocalExercise, LocalTemplateSlot } from "./db";
import {
  BEAT_SECONDS_BY_OBJECTIVE,
  PRESCRIBED_REST_SECONDS,
  estimateTUTSeconds,
  getObjectiveFromSlot,
  type TrainingObjective,
} from "./training-theory";

export type KnownEquipmentType = "barbell" | "free_weight" | "machine" | "cable_stack" | "bodyweight";

export const TRANSITION_SECONDS_BY_EQUIPMENT: Record<KnownEquipmentType | "default", number> = {
  barbell: 120, // Cambiar discos, ajustar rack, cargar barra
  free_weight: 75, // Encontrar las pesas, trasladarse a la zona
  machine: 60, // Ajustar pin de peso, asiento, polea
  cable_stack: 75, // Cambiar altura, grip y peso
  bodyweight: 30, // Solo moverse al área
  default: 90, // Cuando el ejercicio no tiene equipo asociado
};

function transitionSecondsFor(equipmentType: string | null | undefined): number {
  if (equipmentType && equipmentType in TRANSITION_SECONDS_BY_EQUIPMENT) {
    return TRANSITION_SECONDS_BY_EQUIPMENT[equipmentType as KnownEquipmentType];
  }
  return TRANSITION_SECONDS_BY_EQUIPMENT.default;
}

export const SESSION_BUFFERS = {
  warmup_minutes: 5, // Tiempo de calentamiento general al inicio
  technique_reading_first: 30, // Lectura del TechniqueSheet (solo primer ejercicio)
  technique_reading_rest: 0, // No se suma para ejercicios 2+
  countdown_is_included: true, // El countdown está dentro del tiempo de cada serie
} as const;

export type ExerciseTimeEstimate = {
  /** template_slots.id — identificador único del slot (exerciseId NO lo es: un
   *  mismo ejercicio puede repetirse en más de un slot dentro de la misma
   *  plantilla, confirmado en datos reales). */
  slotId: string;
  exerciseId: string;
  exerciseName: string;
  objective: TrainingObjective;
  setupSeconds: number;
  workSeconds: number;
  restSeconds: number;
  countdownSeconds: number;
  totalSeconds: number;
};

export type SessionTimeEstimate = {
  exercises: ExerciseTimeEstimate[];
  warmupSeconds: number;
  totalWorkSeconds: number;
  totalRestSeconds: number;
  totalSetupSeconds: number;
  estimatedTotalSeconds: number;
  estimatedMinutes: number;
  breakdown: string;
};

export type SlotWithExercise = LocalTemplateSlot & {
  exercise: LocalExercise & { equipment: LocalEquipment | undefined };
};

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function estimateSessionTime(slots: SlotWithExercise[]): SessionTimeEstimate {
  const exercises: ExerciseTimeEstimate[] = slots.map((slot, index) => {
    const objective = getObjectiveFromSlot(slot, slot.exercise.unit);
    const setupSeconds =
      transitionSecondsFor(slot.exercise.equipment?.type) +
      (index === 0 ? SESSION_BUFFERS.technique_reading_first : SESSION_BUFFERS.technique_reading_rest);

    const sets = slot.sets ?? 3;
    const reps = slot.reps ?? 10;

    const tutPerSet = estimateTUTSeconds(1, reps, objective);
    const restPerInterval = PRESCRIBED_REST_SECONDS[objective].recommended;
    const countdownPerSet = 3 * BEAT_SECONDS_BY_OBJECTIVE[objective];

    const workSeconds = sets * tutPerSet;
    const restSeconds = Math.max(0, sets - 1) * restPerInterval; // N-1: no hay descanso tras la última serie
    const countdownSeconds = sets * countdownPerSet;

    const totalSeconds = setupSeconds + workSeconds + restSeconds + countdownSeconds;

    return {
      slotId: slot.id,
      exerciseId: slot.exercise_id,
      exerciseName: slot.exercise.name,
      objective,
      setupSeconds,
      workSeconds,
      restSeconds,
      countdownSeconds,
      totalSeconds,
    };
  });

  const warmupSeconds = SESSION_BUFFERS.warmup_minutes * 60;
  const totalWorkSeconds = sum(exercises.map((e) => e.workSeconds));
  const totalRestSeconds = sum(exercises.map((e) => e.restSeconds));
  const totalSetupSeconds = sum(exercises.map((e) => e.setupSeconds));
  const estimatedTotalSeconds = warmupSeconds + sum(exercises.map((e) => e.totalSeconds));
  const estimatedMinutes = Math.ceil(estimatedTotalSeconds / 60);

  const breakdown = `~${Math.round(totalWorkSeconds / 60)} min trabajo · ~${Math.round(
    totalRestSeconds / 60
  )} min descanso · ~${Math.round(totalSetupSeconds / 60)} min traslados`;

  return {
    exercises,
    warmupSeconds,
    totalWorkSeconds,
    totalRestSeconds,
    totalSetupSeconds,
    estimatedTotalSeconds,
    estimatedMinutes,
    breakdown,
  };
}

export type SessionProgress = {
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;
  estimatedEndTime: Date;
  percentComplete: number;
  isAheadOfSchedule: boolean;
  deviationSeconds: number;
  adjustedEstimatedMinutes: number;
};

export function getSessionProgress(
  estimate: SessionTimeEstimate,
  completedSlotIds: string[],
  skippedSlotIds: string[],
  sessionStartTime: Date,
  now: Date = new Date()
): SessionProgress {
  const elapsedSeconds = Math.max(0, Math.round((now.getTime() - sessionStartTime.getTime()) / 1000));

  const doneIds = new Set([...completedSlotIds, ...skippedSlotIds]);
  const totalExercises = estimate.exercises.length;
  const percentComplete = totalExercises === 0 ? 0 : Math.min(1, doneIds.size / totalExercises);

  // Tiempo esperado transcurrido hasta este punto: calentamiento + la suma de
  // los tiempos estimados de los ejercicios (slots) ya completados o saltados.
  const expectedElapsedSoFar =
    estimate.warmupSeconds + sum(estimate.exercises.filter((e) => doneIds.has(e.slotId)).map((e) => e.totalSeconds));

  const deviationSeconds = expectedElapsedSoFar - elapsedSeconds;
  const isAheadOfSchedule = deviationSeconds > 0;

  const estimatedRemainingSeconds = sum(
    estimate.exercises.filter((e) => !doneIds.has(e.slotId)).map((e) => e.totalSeconds)
  );
  const estimatedEndTime = new Date(now.getTime() + estimatedRemainingSeconds * 1000);

  const skippedSet = new Set(skippedSlotIds);
  const adjustedTotalSeconds =
    estimate.warmupSeconds +
    sum(estimate.exercises.filter((e) => !skippedSet.has(e.slotId)).map((e) => e.totalSeconds));
  const adjustedEstimatedMinutes = Math.ceil(adjustedTotalSeconds / 60);

  return {
    elapsedSeconds,
    estimatedRemainingSeconds,
    estimatedEndTime,
    percentComplete,
    isAheadOfSchedule,
    deviationSeconds,
    adjustedEstimatedMinutes,
  };
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return "menos de 1 minuto";
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} minutos`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function formatEstimateSummary(estimate: SessionTimeEstimate): string {
  return `${estimate.breakdown} → ~${estimate.estimatedMinutes} min total`;
}
