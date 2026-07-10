// Capa local-first: espejo de las tablas de Supabase en IndexedDB (Dexie).
// Toda escritura de la UI pasa primero por acá (optimista) y queda marcada
// _dirty=1 hasta que lib/sync.ts la empuje. Solo se usa client-side.

import Dexie, { type Table } from "dexie";
import type { Database } from "@/types/database";

type Mirrored<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"] & {
  /** 1 = tiene cambios locales sin empujar a Supabase. */
  _dirty: 0 | 1;
  /** 1 = borrado localmente, pendiente de propagar el delete remoto. */
  _deleted: 0 | 1;
};

export type LocalEquipment = Mirrored<"equipment">;
export type LocalExercise = Mirrored<"exercises">;
export type LocalDayTemplate = Mirrored<"day_templates">;
export type LocalTemplateSlot = Mirrored<"template_slots">;
export type LocalWeeklySchedule = Mirrored<"weekly_schedule">;
export type LocalSession = Mirrored<"sessions">;
export type LocalSetLog = Mirrored<"set_logs">;
export type LocalE1rmEstimate = Mirrored<"e1rm_estimates">;
export type LocalSessionExerciseStatus = Mirrored<"session_exercise_statuses">;

export const MIRRORED_TABLES = [
  "equipment",
  "exercises",
  "day_templates",
  "template_slots",
  "weekly_schedule",
  "sessions",
  "set_logs",
  "e1rm_estimates",
  "session_exercise_statuses",
] as const;

export type MirroredTableName = (typeof MIRRORED_TABLES)[number];

class AppDB extends Dexie {
  equipment!: Table<LocalEquipment, string>;
  exercises!: Table<LocalExercise, string>;
  day_templates!: Table<LocalDayTemplate, string>;
  template_slots!: Table<LocalTemplateSlot, string>;
  weekly_schedule!: Table<LocalWeeklySchedule, string>;
  sessions!: Table<LocalSession, string>;
  set_logs!: Table<LocalSetLog, string>;
  e1rm_estimates!: Table<LocalE1rmEstimate, string>;
  session_exercise_statuses!: Table<LocalSessionExerciseStatus, string>;

  constructor() {
    super("entreno-lca");
    this.version(1).stores({
      equipment: "id, _dirty",
      exercises: "id, _dirty",
      day_templates: "id, code, _dirty",
      template_slots: "id, day_template_id, _dirty",
      weekly_schedule: "id, weekday, _dirty",
      sessions: "id, date, _dirty",
      set_logs: "id, session_id, exercise_id, _dirty",
      e1rm_estimates: "id, exercise_id, _dirty",
    });
    // v2: agrega session_exercise_statuses (R-3). Dexie exige repetir el
    // schema completo de las tablas sin cambios al subir de versión.
    this.version(2).stores({
      equipment: "id, _dirty",
      exercises: "id, _dirty",
      day_templates: "id, code, _dirty",
      template_slots: "id, day_template_id, _dirty",
      weekly_schedule: "id, weekday, _dirty",
      sessions: "id, date, _dirty",
      set_logs: "id, session_id, exercise_id, _dirty",
      e1rm_estimates: "id, exercise_id, _dirty",
      session_exercise_statuses: "id, session_id, exercise_id, _dirty",
    });
    // v3: set_logs suma template_slot_id — exercise_id no identifica un slot
    // (un mismo ejercicio puede repetirse en más de un slot de la plantilla).
    this.version(3).stores({
      equipment: "id, _dirty",
      exercises: "id, _dirty",
      day_templates: "id, code, _dirty",
      template_slots: "id, day_template_id, _dirty",
      weekly_schedule: "id, weekday, _dirty",
      sessions: "id, date, _dirty",
      set_logs: "id, session_id, exercise_id, template_slot_id, _dirty",
      e1rm_estimates: "id, exercise_id, _dirty",
      session_exercise_statuses: "id, session_id, exercise_id, _dirty",
    });
    // v4: session_exercise_statuses también indexa template_slot_id — el
    // historial de patrones (lib/skip-patterns.ts) ahora consulta por slot
    // (propósito de entrenamiento), no por exercise_id.
    this.version(4).stores({
      equipment: "id, _dirty",
      exercises: "id, _dirty",
      day_templates: "id, code, _dirty",
      template_slots: "id, day_template_id, _dirty",
      weekly_schedule: "id, weekday, _dirty",
      sessions: "id, date, _dirty",
      set_logs: "id, session_id, exercise_id, template_slot_id, _dirty",
      e1rm_estimates: "id, exercise_id, _dirty",
      session_exercise_statuses: "id, session_id, exercise_id, template_slot_id, _dirty",
    });
  }
}

// Una sola instancia por pestaña; Dexie ya maneja IndexedDB siendo singleton.
export const db = new AppDB();

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}
