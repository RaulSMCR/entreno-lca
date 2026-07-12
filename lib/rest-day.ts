// Día de descanso: en vez de quedar vacío, se auto-completa con un duplicado
// de los ejercicios de movilidad del día anterior del ciclo semanal fijo
// (domingo siempre mira sábado, sea cual sea la fecha real de hoy — no
// depende de new Date(), a propósito: así se puede llamar desde cualquier
// pantalla — Entrenar, Plantillas — sin esperar a que el usuario abra la app
// justo el día de descanso). Local-first como el resto de la app: toda
// escritura va a Dexie (_dirty: 1), lib/sync.ts la empuja sola
// (day_templates/template_slots ya están en MIRRORED_TABLES).

import { db, newId, nowIso } from "./db";
import { WEEKDAYS } from "./date";

const MOBILITY_PURPOSES = new Set(["movilidad_repeticiones", "movilidad_tiempo"]);

// "DA" (Descanso Activo) — mismo código para cualquier día de descanso, igual
// convención corta que A1/A2/B1/B2/C1/C2. Si hay más de un weekday de
// descanso en la semana, hoy se toma el primero que aparece en
// weekly_schedule (limitación aceptada: no soporta más de un descanso activo
// distinto en simultáneo).
const REST_DAY_CODE = "DA";

function weekdayBefore(weekday: string): string {
  const idx = WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]);
  if (idx === -1) return weekday;
  return WEEKDAYS[(idx - 1 + WEEKDAYS.length) % WEEKDAYS.length];
}

// Idempotente y seguro de llamar en cualquier momento: si la plantilla "DA"
// actual ya tiene series registradas (set_logs apuntando a sus
// template_slots — sesión en curso o completada), no la toca, para no dejar
// esos registros huérfanos. Solo la recrea cuando está "limpia".
export async function ensureRestDayTemplate(userId: string): Promise<string | null> {
  const schedule = await db.weekly_schedule.toArray();
  const restEntry = schedule.find((e) => !e.day_template_id);
  if (!restEntry) return null;

  const previousWeekday = weekdayBefore(restEntry.weekday);
  const previousEntry = schedule.find((e) => e.weekday === previousWeekday);
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
  const existingTemplate = await db.day_templates.where("code").equals(REST_DAY_CODE).first();

  if (existingTemplate) {
    const currentSlotIds = (
      await db.template_slots.where("day_template_id").equals(existingTemplate.id).toArray()
    ).map((s) => s.id);
    const hasLoggedSets =
      currentSlotIds.length > 0 && (await db.set_logs.where("template_slot_id").anyOf(currentSlotIds).count()) > 0;
    if (hasLoggedSets) return existingTemplate.id;
  }

  const template = existingTemplate
    ? { ...existingTemplate, focus: `Movilidad de ${previousEntry.weekday}`, updated_at: now, _dirty: 1 as const }
    : {
        id: newId(),
        user_id: userId,
        code: REST_DAY_CODE,
        title: "Descanso Activo",
        focus: `Movilidad de ${previousEntry.weekday}`,
        created_at: now,
        updated_at: now,
        _dirty: 1 as const,
        _deleted: 0 as const,
      };
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
