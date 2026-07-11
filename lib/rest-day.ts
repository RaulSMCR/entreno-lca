// Día de descanso: en vez de quedar vacío, se auto-completa con un duplicado
// de los ejercicios de movilidad del día anterior del ciclo semanal (fijo,
// vía weekly_schedule — no la sesión realmente registrada ayer). Local-first
// como el resto de la app: toda escritura va a Dexie (_dirty: 1), lib/sync.ts
// la empuja sola (day_templates/template_slots ya están en MIRRORED_TABLES).

import { db, newId, nowIso } from "./db";
import { yesterdayWeekday } from "./date";

const MOBILITY_PURPOSES = new Set(["movilidad_repeticiones", "movilidad_tiempo"]);

function restDayTemplateCode(restWeekday: string): string {
  const normalized = restWeekday
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
  return `DESCANSO_${normalized}`;
}

// Idempotente y solo seguro de llamar ANTES de que exista una sesión de hoy:
// si ya hay set_logs/session_exercise_statuses apuntando a los template_slots
// de una corrida anterior, recrearlos los dejaría huérfanos.
export async function ensureRestDayTemplate(userId: string, restWeekday: string): Promise<string | null> {
  const previousWeekday = yesterdayWeekday();
  const previousEntry = await db.weekly_schedule.where("weekday").equals(previousWeekday).first();
  if (!previousEntry?.day_template_id) return null;

  const previousSlots = await db.template_slots
    .where("day_template_id")
    .equals(previousEntry.day_template_id)
    .toArray();
  if (previousSlots.length === 0) return null;

  const exerciseIds = Array.from(new Set(previousSlots.map((s) => s.exercise_id)));
  const exercises = (await db.exercises.bulkGet(exerciseIds)).filter((e): e is NonNullable<typeof e> => !!e);
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));

  const mobilitySlots = previousSlots
    .filter((s) => MOBILITY_PURPOSES.has(exerciseById.get(s.exercise_id)?.purpose ?? ""))
    .sort((a, b) => a.slot_order - b.slot_order);
  if (mobilitySlots.length === 0) return null;

  const now = nowIso();
  const code = restDayTemplateCode(restWeekday);

  let template = await db.day_templates.where("code").equals(code).first();
  if (!template) {
    template = {
      id: newId(),
      user_id: userId,
      code,
      title: "Descanso — Movilidad",
      focus: `Duplicado de ${previousEntry.weekday}`,
      created_at: now,
      updated_at: now,
      _dirty: 1,
      _deleted: 0,
    };
  } else {
    template = { ...template, updated_at: now, _dirty: 1 };
  }
  await db.day_templates.put(template);

  const staleSlots = await db.template_slots.where("day_template_id").equals(template.id).toArray();
  for (const slot of staleSlots) {
    await db.template_slots.update(slot.id, { _deleted: 1, _dirty: 1, updated_at: now });
  }

  let order = 1;
  for (const slot of mobilitySlots) {
    await db.template_slots.put({
      id: newId(),
      user_id: userId,
      day_template_id: template.id,
      exercise_id: slot.exercise_id,
      slot_order: order++,
      block: slot.block,
      sets: slot.sets,
      reps: slot.reps,
      pct_max: slot.pct_max,
      rpe_target: slot.rpe_target,
      scheme_raw: slot.scheme_raw,
      reps_or_time: slot.reps_or_time,
      intensity_note: slot.intensity_note,
      target_duration_seconds: slot.target_duration_seconds,
      created_at: now,
      updated_at: now,
      _dirty: 1,
      _deleted: 0,
    });
  }

  return template.id;
}
