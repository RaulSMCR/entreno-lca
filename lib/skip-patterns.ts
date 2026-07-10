// R-4: análisis de patrones de omisión/incompletitud y generación de alertas.
//
// Adaptaciones respecto del prompt original:
// - No hay una segunda caché con TTL de 24h: Dexie ya es la caché local-first
//   (lib/sync.ts la mantiene al día), agregar otra capa sería redundante.
// - Todo esto es por template_slot_id, NO por exercise_id. Un mismo ejercicio
//   puede repetirse en más de un slot dentro de la misma plantilla con
//   propósitos de entrenamiento distintos (p.ej. fuerza en un slot, volumen
//   en otro) — confirmado con el usuario que eso debe tratarse como dos
//   entidades de seguimiento separadas, no una. template_slot_id es estable
//   sesión a sesión (la plantilla no cambia), así que es la clave correcta
//   para el historial de patrones: agrupar por exercise_id mezclaría el
//   historial de "omití la versión de fuerza" con el de "omití la versión de
//   volumen" del mismo ejercicio, que son problemas distintos.

import { db, type LocalSession } from "./db";
import type { ExerciseStatus, SkipReason } from "./session-exercise";

export type SkipRecord = {
  sessionId: string;
  sessionDate: string;
  status: ExerciseStatus;
  skipReason: SkipReason | null;
  skipNote: string | null;
  setsCompleted: number;
  setsPlanned: number;
};

// La restricción unique(session_id, template_slot_id) garantiza a lo sumo
// una fila por sesión para este slot — a diferencia de exercise_id, acá no
// hace falta combinar/desduplicar filas de una misma sesión.
export async function getSkipHistory(templateSlotId: string, lookbackSessions: number = 6): Promise<SkipRecord[]> {
  const statuses = await db.session_exercise_statuses.where("template_slot_id").equals(templateSlotId).toArray();
  if (statuses.length === 0) return [];

  const sessionIds = Array.from(new Set(statuses.map((s) => s.session_id)));
  const sessions = await db.sessions.bulkGet(sessionIds);
  const sessionById = new Map(
    sessions.filter((s): s is LocalSession => !!s).map((s) => [s.id, s])
  );

  return statuses
    .filter((s) => s._deleted !== 1 && sessionById.has(s.session_id))
    .map((s) => ({
      sessionId: s.session_id,
      sessionDate: sessionById.get(s.session_id)!.date,
      status: s.status as ExerciseStatus,
      skipReason: (s.skip_reason as SkipReason | null) ?? null,
      skipNote: s.skip_note,
      setsCompleted: s.sets_completed,
      setsPlanned: s.sets_planned,
    }))
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
    .slice(0, lookbackSessions);
}

export type PatternType =
  | "recurring_skip"
  | "recurring_equipment_issue"
  | "recurring_station_busy"
  | "chronic_partial"
  | "physical_concern";

export type PatternSeverity = "info" | "warning" | "critical";

export type SkipPatternBase = {
  type: PatternType;
  /** template_slots.id — identidad real del patrón (ver nota de arriba). */
  slotId: string;
  exerciseId: string;
  exerciseName: string;
  reason: SkipReason | null;
  occurrences: number;
  totalSessions: number;
  severity: PatternSeverity;
};

export type SkipPattern = SkipPatternBase & { recommendation: SkipRecommendation };

export type SlotIdentity = { slotId: string; exerciseId: string; exerciseName: string };

// Evalúa las reglas en orden de prioridad y devuelve el primer patrón que
// matchee (0 o 1 elemento) — evita que un mismo slot dispare varias alertas
// superpuestas en la misma sesión.
export function detectSkipPatterns(history: SkipRecord[], slot: SlotIdentity): SkipPatternBase[] {
  const last2 = history.slice(0, 2);
  const last4 = history.slice(0, 4);
  const last6 = history.slice(0, 6);

  const physicalConcernCount = last2.filter((r) => r.skipReason === "physical_discomfort").length;
  if (physicalConcernCount >= 1) {
    return [
      {
        type: "physical_concern",
        slotId: slot.slotId,
        exerciseId: slot.exerciseId,
        exerciseName: slot.exerciseName,
        reason: "physical_discomfort",
        occurrences: physicalConcernCount,
        totalSessions: last2.length,
        severity: "critical",
      },
    ];
  }

  const stationBusyCount = last4.filter((r) => r.skipReason === "station_occupied").length;
  if (stationBusyCount >= 2) {
    return [
      {
        type: "recurring_station_busy",
        slotId: slot.slotId,
        exerciseId: slot.exerciseId,
        exerciseName: slot.exerciseName,
        reason: "station_occupied",
        occurrences: stationBusyCount,
        totalSessions: last4.length,
        severity: "warning",
      },
    ];
  }

  const equipmentIssueCount = last4.filter((r) => r.skipReason === "equipment_unavailable").length;
  if (equipmentIssueCount >= 2) {
    return [
      {
        type: "recurring_equipment_issue",
        slotId: slot.slotId,
        exerciseId: slot.exerciseId,
        exerciseName: slot.exerciseName,
        reason: "equipment_unavailable",
        occurrences: equipmentIssueCount,
        totalSessions: last4.length,
        severity: "warning",
      },
    ];
  }

  const chronicPartialCount = last4.filter((r) => r.status === "partial").length;
  if (chronicPartialCount >= 3) {
    return [
      {
        type: "chronic_partial",
        slotId: slot.slotId,
        exerciseId: slot.exerciseId,
        exerciseName: slot.exerciseName,
        reason: null,
        occurrences: chronicPartialCount,
        totalSessions: last4.length,
        severity: "info",
      },
    ];
  }

  const recurringSkipCount = last6.filter((r) => r.status === "skipped" || r.status === "partial").length;
  if (recurringSkipCount >= 3) {
    return [
      {
        type: "recurring_skip",
        slotId: slot.slotId,
        exerciseId: slot.exerciseId,
        exerciseName: slot.exerciseName,
        reason: null,
        occurrences: recurringSkipCount,
        totalSessions: last6.length,
        severity: "info",
      },
    ];
  }

  return [];
}

export type RecommendedActionType =
  | "reorder_in_session"
  | "suggest_alternative"
  | "change_schedule"
  | "consult_professional"
  | "adjust_load";

export type RecommendedAction = {
  label: string;
  actionType: RecommendedActionType;
  data?: Record<string, unknown>;
};

export type SkipRecommendation = {
  title: string;
  body: string;
  actions: RecommendedAction[];
  impactNote: string;
};

export function buildRecommendation(
  pattern: SkipPatternBase,
  context: { block?: string; equipmentName?: string } = {}
): SkipRecommendation {
  const { exerciseName, occurrences, totalSessions } = pattern;

  switch (pattern.type) {
    case "physical_concern":
      return {
        title: "⚠️ Molestia física recurrente",
        body: `Registraste molestia en ${exerciseName} en sesiones recientes. Esto puede indicar sobrecarga, técnica incorrecta o una condición subyacente.`,
        actions: [
          { label: "Reducir carga un 10%", actionType: "adjust_load", data: { pct: -10 } },
          { label: "Consultar con profesional de salud", actionType: "consult_professional" },
        ],
        impactNote: `${exerciseName} está en tu plan semanal.`,
      };
    case "recurring_station_busy":
      return {
        title: "🚧 Estación frecuentemente ocupada",
        body: `La estación de ${exerciseName} ha estado ocupada en ${occurrences} de tus últimas ${totalSessions} sesiones.`,
        actions: [
          { label: "Mover al inicio de la sesión", actionType: "reorder_in_session" },
          { label: "Buscar ejercicio alternativo", actionType: "suggest_alternative" },
        ],
        impactNote: context.block
          ? `${exerciseName} está en el bloque ${context.block} de tu plan de hoy.`
          : `${exerciseName} está en tu plan de hoy.`,
      };
    case "recurring_equipment_issue":
      return {
        title: "🔧 Equipo no siempre disponible",
        body: `El equipo para ${exerciseName} no estuvo disponible en ${occurrences} sesiones recientes.`,
        actions: [
          { label: "Buscar ejercicio alternativo", actionType: "suggest_alternative" },
          { label: "Reportar equipo faltante", actionType: "change_schedule" },
        ],
        impactNote: context.equipmentName
          ? `${exerciseName} requiere ${context.equipmentName}.`
          : `${exerciseName} depende de un equipo específico.`,
      };
    case "chronic_partial":
      return {
        title: "📉 Ejercicio consistentemente incompleto",
        body: `Completás solo parte de las series de ${exerciseName} en la mayoría de las sesiones.`,
        actions: [
          {
            label: "Reducir sets planeados a los que realmente hacés",
            actionType: "adjust_load",
            data: { reduce_sets: true },
          },
          { label: "Investigar causa (ver historial)", actionType: "change_schedule" },
        ],
        impactNote: `Completar el volumen planeado de ${exerciseName} impacta tu progreso.`,
      };
    case "recurring_skip":
      return {
        title: "⏭️ Ejercicio frecuentemente omitido",
        body: `Has omitido ${exerciseName} en ${occurrences} de tus últimas ${totalSessions} sesiones.`,
        actions: [{ label: "Revisar la necesidad de este ejercicio en el plan", actionType: "suggest_alternative" }],
        impactNote: context.block
          ? `${exerciseName} cubre parte del bloque ${context.block}.`
          : `${exerciseName} está en tu plan.`,
      };
  }
}

export type SlotForPatternAnalysis = { id: string; exercise_id: string; block: string };
export type ExerciseForPatternAnalysis = { id: string; name: string; equipment?: { name: string } | null };

const SEVERITY_RANK: Record<PatternSeverity, number> = { critical: 0, warning: 1, info: 2 };

export async function analyzeSessionPatterns(
  slots: SlotForPatternAnalysis[],
  exercises: ExerciseForPatternAnalysis[]
): Promise<SkipPattern[]> {
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const patterns: SkipPattern[] = [];

  for (const slot of slots) {
    const exercise = exerciseById.get(slot.exercise_id);
    if (!exercise) continue;

    const history = await getSkipHistory(slot.id, 6);
    if (history.length === 0) continue;

    const detected = detectSkipPatterns(history, { slotId: slot.id, exerciseId: exercise.id, exerciseName: exercise.name });
    for (const raw of detected) {
      patterns.push({
        ...raw,
        recommendation: buildRecommendation(raw, { block: slot.block, equipmentName: exercise.equipment?.name }),
      });
    }
  }

  patterns.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return patterns.slice(0, 3);
}
