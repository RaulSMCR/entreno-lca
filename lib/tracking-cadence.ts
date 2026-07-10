// Cadencias de tracking corporal/calibración (U-1 Parte B). Local-first: lee y
// escribe sobre Dexie (mismo patrón de EntrenarClient.tsx/WorkoutSetFlow.tsx —
// put()/update() marcando _dirty: 1, lib/sync.ts se encarga de empujarlo).

import { db, newId, nowIso } from "./db";

export type TrackingType = "body_weight" | "inbody_scan" | "rm_retest";
export type TrackingUrgency = "ok" | "due_soon" | "overdue";

export type TrackingStatus = {
  type: TrackingType;
  frequencyDays: number;
  lastDoneAt: string | null;
  nextDueAt: string | null;
  urgency: TrackingUrgency;
};

const DUE_SOON_WINDOW_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function frequencyDaysFor(
  profile: { weight_tracking_frequency_days: number; inbody_tracking_frequency_days: number; rm_retest_frequency_days: number },
  type: TrackingType
): number {
  if (type === "body_weight") return profile.weight_tracking_frequency_days;
  if (type === "inbody_scan") return profile.inbody_tracking_frequency_days;
  return profile.rm_retest_frequency_days;
}

// Exportada para test: es la única parte de este archivo sin I/O (el resto habla
// con Dexie), mismo criterio de lib/skip-patterns.ts (detectSkipPatterns/
// buildRecommendation se testean solas, getSkipHistory no).
export function statusFromLastDone(type: TrackingType, frequencyDays: number, lastDoneAt: string | null): TrackingStatus {
  if (!lastDoneAt) {
    return { type, frequencyDays, lastDoneAt: null, nextDueAt: null, urgency: "overdue" };
  }

  const nextDueAt = new Date(new Date(lastDoneAt).getTime() + frequencyDays * DAY_MS).toISOString();
  const daysUntilDue = (new Date(nextDueAt).getTime() - Date.now()) / DAY_MS;

  const urgency: TrackingUrgency = daysUntilDue < 0 ? "overdue" : daysUntilDue <= DUE_SOON_WINDOW_DAYS ? "due_soon" : "ok";

  return { type, frequencyDays, lastDoneAt, nextDueAt, urgency };
}

// rm_retest no confía en tracking_reminders.last_done_at: la fuente de verdad es
// la calibration_session '1RM_day' más reciente (el propio Día 1RM es lo que
// "cuenta" como retest, no un botón separado de "marcar hecho").
async function lastRmRetestDate(): Promise<string | null> {
  const sessions = await db.calibration_sessions.where("session_type").equals("1RM_day").toArray();
  if (sessions.length === 0) return null;
  return sessions.reduce((latest, s) => (s.performed_at > latest ? s.performed_at : latest), sessions[0].performed_at);
}

export async function getTrackingStatuses(userId: string): Promise<TrackingStatus[]> {
  const profile = await db.user_profiles.get(userId);
  const weightTrackingFrequencyDays = profile?.weight_tracking_frequency_days ?? 7;
  const inbodyTrackingFrequencyDays = profile?.inbody_tracking_frequency_days ?? 56;
  const rmRetestFrequencyDays = profile?.rm_retest_frequency_days ?? 84;
  const frequencies = {
    weight_tracking_frequency_days: weightTrackingFrequencyDays,
    inbody_tracking_frequency_days: inbodyTrackingFrequencyDays,
    rm_retest_frequency_days: rmRetestFrequencyDays,
  };

  const reminders = await db.tracking_reminders.toArray();
  const reminderByType = new Map(reminders.map((r) => [r.type as TrackingType, r]));

  const rmRetestLastDone = await lastRmRetestDate();

  const types: TrackingType[] = ["body_weight", "inbody_scan", "rm_retest"];
  return types.map((type) => {
    const frequencyDays = frequencyDaysFor(frequencies, type);
    const lastDoneAt = type === "rm_retest" ? rmRetestLastDone : (reminderByType.get(type)?.last_done_at ?? null);
    return statusFromLastDone(type, frequencyDays, lastDoneAt);
  });
}

export async function markTrackingDone(userId: string, type: TrackingType): Promise<void> {
  const profile = await db.user_profiles.get(userId);
  const frequencyDays = profile
    ? frequencyDaysFor(profile, type)
    : type === "body_weight"
      ? 7
      : type === "inbody_scan"
        ? 56
        : 84;

  const now = nowIso();
  const nextDueAt = new Date(Date.now() + frequencyDays * DAY_MS).toISOString();

  const existing = await db.tracking_reminders.where("type").equals(type).first();
  if (existing) {
    await db.tracking_reminders.update(existing.id, {
      last_done_at: now,
      next_due_at: nextDueAt,
      is_dismissed: false,
      updated_at: now,
      _dirty: 1,
    });
    return;
  }

  await db.tracking_reminders.put({
    id: newId(),
    user_id: userId,
    type,
    last_done_at: now,
    next_due_at: nextDueAt,
    is_dismissed: false,
    created_at: now,
    updated_at: now,
    _dirty: 1,
    _deleted: 0,
  });
}
