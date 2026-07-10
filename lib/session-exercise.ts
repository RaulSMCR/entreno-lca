// R-3: estado por ejercicio dentro de una sesión. Local-first como el resto de
// la app — toda escritura va a Dexie (_dirty: 1) y lib/sync.ts la empuja a
// Supabase cuando hay conexión (session_exercise_statuses ya está en
// MIRRORED_TABLES, no hace falta tocar sync.ts).

import { db, newId, nowIso, type LocalSessionExerciseStatus } from "./db";

export type ExerciseStatus = "pending" | "in_progress" | "partial" | "completed" | "skipped";

export type SkipReason =
  | "station_occupied"
  | "equipment_unavailable"
  | "physical_discomfort"
  | "no_time"
  | "other";

export type SessionExerciseStatus = LocalSessionExerciseStatus;

// Idempotente: si ya existe una fila para (session_id, exercise_id) no la
// duplica ni la pisa (respeta el progreso si se llama de nuevo al reabrir la
// sesión).
export async function initSessionExerciseStatuses(params: {
  sessionId: string;
  userId: string;
  slots: { id: string; exercise_id: string; sets: number | null }[];
}): Promise<void> {
  const { sessionId, userId, slots } = params;
  const existing = await db.session_exercise_statuses.where("session_id").equals(sessionId).toArray();
  const existingExerciseIds = new Set(existing.map((s) => s.exercise_id));
  const now = nowIso();

  for (const slot of slots) {
    if (existingExerciseIds.has(slot.exercise_id)) continue;
    const row: LocalSessionExerciseStatus = {
      id: newId(),
      created_at: now,
      updated_at: now,
      user_id: userId,
      session_id: sessionId,
      exercise_id: slot.exercise_id,
      template_slot_id: slot.id,
      status: "pending",
      skip_reason: null,
      skip_note: null,
      sets_planned: slot.sets ?? 3,
      sets_completed: 0,
      execution_order: null,
      started_at: null,
      completed_at: null,
      actual_duration_seconds: null,
      _dirty: 1,
      _deleted: 0,
    };
    await db.session_exercise_statuses.put(row);
  }
}

export async function updateExerciseStatus(params: {
  sessionId: string;
  exerciseId: string;
  status: ExerciseStatus;
  skipReason?: SkipReason | null;
  skipNote?: string | null;
  setsCompleted?: number;
  executionOrder?: number;
  startedAt?: Date;
  completedAt?: Date;
}): Promise<void> {
  const existing = (
    await db.session_exercise_statuses.where("session_id").equals(params.sessionId).toArray()
  ).find((s) => s.exercise_id === params.exerciseId);

  if (!existing) {
    throw new Error(
      `No hay session_exercise_statuses para exercise ${params.exerciseId} en la sesión ${params.sessionId}. ` +
        `Llamá initSessionExerciseStatuses al iniciar la sesión.`
    );
  }

  const startedAtIso = params.startedAt ? params.startedAt.toISOString() : existing.started_at;
  const completedAtIso = params.completedAt ? params.completedAt.toISOString() : existing.completed_at;
  const actualDurationSeconds =
    startedAtIso && completedAtIso
      ? Math.round((new Date(completedAtIso).getTime() - new Date(startedAtIso).getTime()) / 1000)
      : existing.actual_duration_seconds;

  await db.session_exercise_statuses.update(existing.id, {
    status: params.status,
    skip_reason: params.skipReason ?? existing.skip_reason,
    skip_note: params.skipNote ?? existing.skip_note,
    sets_completed: params.setsCompleted ?? existing.sets_completed,
    execution_order: params.executionOrder ?? existing.execution_order,
    started_at: startedAtIso,
    completed_at: completedAtIso,
    actual_duration_seconds: actualDurationSeconds,
    updated_at: nowIso(),
    _dirty: 1,
  });
}

export async function getSessionExerciseStatuses(sessionId: string): Promise<SessionExerciseStatus[]> {
  return db.session_exercise_statuses.where("session_id").equals(sessionId).toArray();
}

export type SessionCompletion = {
  total: number;
  completed: number;
  partial: number;
  skipped: number;
  pending: number;
  completionRate: number; // (completed + partial) / total
  fullCompletionRate: number; // completed / total
  skippedByReason: Record<SkipReason, number>;
};

const EMPTY_SKIPPED_BY_REASON: Record<SkipReason, number> = {
  station_occupied: 0,
  equipment_unavailable: 0,
  physical_discomfort: 0,
  no_time: 0,
  other: 0,
};

export function computeSessionCompletion(statuses: SessionExerciseStatus[]): SessionCompletion {
  const total = statuses.length;
  const completed = statuses.filter((s) => s.status === "completed").length;
  const partial = statuses.filter((s) => s.status === "partial").length;
  const skipped = statuses.filter((s) => s.status === "skipped").length;
  const pending = statuses.filter((s) => s.status === "pending" || s.status === "in_progress").length;

  const skippedByReason = { ...EMPTY_SKIPPED_BY_REASON };
  for (const s of statuses) {
    if (s.status === "skipped" && s.skip_reason) {
      skippedByReason[s.skip_reason as SkipReason] += 1;
    }
  }

  return {
    total,
    completed,
    partial,
    skipped,
    pending,
    completionRate: total === 0 ? 0 : (completed + partial) / total,
    fullCompletionRate: total === 0 ? 0 : completed / total,
    skippedByReason,
  };
}
