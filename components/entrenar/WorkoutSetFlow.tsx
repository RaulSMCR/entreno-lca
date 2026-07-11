"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, newId, nowIso, type LocalSession } from "@/lib/db";
import { todayIso } from "@/lib/date";
import { SyncStatus } from "@/components/SyncStatus";
import { SlotCard, type VoicePrefill } from "./SlotCard";
import { VoiceCapture, type VoiceContextExercise } from "./VoiceCapture";
import { TechniqueSheet } from "./TechniqueSheet";
import { SkipModal } from "./SkipModal";
import { SessionNavigator, type NavigatorExercise } from "./SessionNavigator";
import type { OmittedExerciseSummary } from "./ResumenView";
import { adjustPlannedSets, suggestNextLoad, suggestNextTarget, updateE1rm, type LoadSuggestion } from "@/lib/engine";
import { resolveAvailableLoads, type EquipmentLoadConfig } from "@/lib/loads";
import type { VoiceParsedSet } from "@/app/api/parse-voice/route";
import { estimateSessionTime, getSessionProgress, type SlotWithExercise } from "@/lib/session-time";
import { getObjectiveFromSlot } from "@/lib/training-theory";
import {
  getSessionExerciseStatuses,
  updateExerciseStatus,
  type ExerciseStatus,
  type SkipReason,
} from "@/lib/session-exercise";
import { analyzeSessionPatterns, detectSkipPatterns, getSkipHistory, type SkipPattern } from "@/lib/skip-patterns";

const NO_EQUIPMENT: EquipmentLoadConfig = { load_mode: "range", min_kg: 0, max_kg: 0, step_kg: 0 };

export type SessionSummary =
  | {
      kind: "load";
      exerciseName: string;
      /** Distingue el slot cuando el mismo ejercicio aparece más de una vez
       *  esta sesión con propósitos distintos (p.ej. fuerza vs volumen). */
      slotLabel: string | null;
      oldE1rm: number | null;
      newE1rm: number;
      e1rmUpdated: boolean;
      suggestion: LoadSuggestion | null;
      setsNote?: string | null;
    }
  | {
      kind: "nonload";
      exerciseName: string;
      slotLabel: string | null;
      unit: string;
      target: number;
      isPR: boolean;
    }
  | {
      kind: "cardio";
      exerciseName: string;
      slotLabel: string | null;
      targetSeconds: number | null;
      actualSeconds: number;
      status: "short" | "met" | "exceeded" | null;
    };

export type WorkoutFinishResult = {
  summary: SessionSummary[];
  omitted: OmittedExerciseSummary[];
  volumeCompletion: { completedSets: number; plannedSets: number; pct: number };
};

// Igual que en CardioSetRow.tsx — duplicado a propósito (mismo criterio ya
// usado en el resto del código para esta función chica).
function classifyCardio(actualSeconds: number, targetSeconds: number): "short" | "met" | "exceeded" {
  if (actualSeconds < targetSeconds * 0.9) return "short";
  if (actualSeconds > targetSeconds * 1.1) return "exceeded";
  return "met";
}

function schemeLabel(slot: SlotWithExercise): string {
  const sets = slot.sets ?? "?";
  if (slot.exercise.unit !== "kg") {
    return slot.reps_or_time ? `${sets}× ${slot.reps_or_time}` : `${sets} series`;
  }
  const parts = [`${sets}×${slot.reps ?? "?"}`];
  if (slot.pct_max != null) parts.push(`${slot.pct_max}%`);
  if (slot.rpe_target != null) parts.push(`RPE ${slot.rpe_target}`);
  return parts.join(" · ");
}

// R-2 adaptado: orquestador secuencial de un ejercicio a la vez (reemplaza el
// listado plano que tenía SesionView), con navegador flotente (R-2),
// technique sheet inicial (P), countdown/descanso no bloqueantes (T, vía
// SlotCard) y skip modal (R-3).
//
// Identidad por template_slot_id, NO por exercise_id: un mismo ejercicio
// puede repetirse en más de un slot dentro de la misma plantilla, incluso con
// propósitos de entrenamiento distintos (fuerza vs volumen) — confirmado con
// el usuario que eso son dos entidades de seguimiento separadas. Navegación,
// estado de sesión, historial de patrones y sugerencia de carga son todos
// por-slot. Solo el e1RM se sigue calculando por-ejercicio (agrega todas las
// series del ejercicio sin importar el slot): es una propiedad del
// movimiento, no del propósito con que se entrenó ese día.
export function WorkoutSetFlow({
  session,
  userId,
  prioritySlotId,
  onFinish,
}: {
  session: LocalSession;
  userId: string;
  /** R-4: "Mover al inicio de la sesión" — decidido en el briefing, antes de
   *  que exista executionOrder acá. */
  prioritySlotId?: string | null;
  onFinish: (result: WorkoutFinishResult) => void;
}) {
  const [finishing, setFinishing] = useState(false);
  const [voiceMatches, setVoiceMatches] = useState<Record<string, VoicePrefill>>({});
  const [techniqueAcknowledged, setTechniqueAcknowledged] = useState(false);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [executionOrder, setExecutionOrder] = useState<string[] | null>(null);
  const [skipTargetSlotId, setSkipTargetSlotId] = useState<string | null>(null);
  const [patterns, setPatterns] = useState<SkipPattern[]>([]);
  const [sessionStart] = useState(() => new Date());

  const slots = useLiveQuery(
    async () => {
      if (!session.day_template_id) return [];
      const rows = await db.template_slots.where("day_template_id").equals(session.day_template_id).toArray();
      return rows.sort((a, b) => a.slot_order - b.slot_order);
    },
    [session.day_template_id],
    []
  );

  const slotsWithExercise = useLiveQuery(
    async () => {
      const exerciseIds = Array.from(new Set((slots ?? []).map((s) => s.exercise_id)));
      const exercises = (await db.exercises.bulkGet(exerciseIds)).filter((e): e is NonNullable<typeof e> => !!e);
      const equipmentIds = Array.from(new Set(exercises.map((e) => e.equipment_id).filter((id): id is string => !!id)));
      const equipmentRows = (await db.equipment.bulkGet(equipmentIds)).filter((e): e is NonNullable<typeof e> => !!e);
      const equipmentById = new Map(equipmentRows.map((e) => [e.id, e]));
      const exerciseById = new Map(exercises.map((e) => [e.id, e]));

      return (slots ?? [])
        .map((slot) => {
          const exercise = exerciseById.get(slot.exercise_id);
          if (!exercise) return null;
          const equipment = exercise.equipment_id ? equipmentById.get(exercise.equipment_id) : undefined;
          return { ...slot, exercise: { ...exercise, equipment } };
        })
        .filter((s): s is SlotWithExercise => s != null);
    },
    [slots],
    [] as SlotWithExercise[]
  );

  const statuses = useLiveQuery(
    () => db.session_exercise_statuses.where("session_id").equals(session.id).toArray(),
    [session.id],
    []
  );

  const estimate = useMemo(
    () => (slotsWithExercise.length > 0 ? estimateSessionTime(slotsWithExercise) : null),
    [slotsWithExercise]
  );

  const statusBySlot = useMemo(() => new Map(statuses.map((s) => [s.template_slot_id, s])), [statuses]);

  const navigatorExercises: NavigatorExercise[] = useMemo(
    () =>
      slotsWithExercise.map((slot) => {
        const st = statusBySlot.get(slot.id);
        const est = estimate?.exercises.find((e) => e.slotId === slot.id);
        return {
          slotId: slot.id,
          exerciseId: slot.exercise_id,
          exerciseName: slot.exercise.name,
          scheme: schemeLabel(slot),
          estimatedMinutes: est ? Math.round(est.totalSeconds / 60) : 0,
          status: (st?.status as ExerciseStatus) ?? "pending",
          block: slot.block,
          originalOrder: slot.slot_order,
        };
      }),
    [slotsWithExercise, statusBySlot, estimate]
  );

  // Orden por defecto (slot_order, con el ejercicio priorizado —R-4: "mover
  // al inicio"— adelantado si corresponde). Se memoiza para que, dentro de
  // un mismo render, tanto la inicialización de executionOrder como la de
  // activeSlotId lean el mismo valor: leer el estado `executionOrder` recién
  // seteado en este mismo render devolvería el valor viejo (null), no el que
  // se acaba de calcular.
  const defaultOrder = useMemo(() => {
    const base = slotsWithExercise.map((s) => s.id);
    if (!prioritySlotId || !base.includes(prioritySlotId)) return base;
    return [prioritySlotId, ...base.filter((id) => id !== prioritySlotId)];
  }, [slotsWithExercise, prioritySlotId]);

  // Ajustes de estado durante el render (no en efectos) para inicializar el
  // orden de ejecución y el slot activo apenas hay datos disponibles: ambos
  // son guardados (solo disparan una vez) y convergen sin loops.
  if (executionOrder == null && slotsWithExercise.length > 0) {
    setExecutionOrder(defaultOrder);
  }

  if (activeSlotId == null) {
    const order = executionOrder ?? defaultOrder;
    const next = order.find((id) => {
      const st = statusBySlot.get(id)?.status ?? "pending";
      return st === "pending" || st === "in_progress";
    });
    if (next) setActiveSlotId(next);
  }

  useEffect(() => {
    if (!activeSlotId) return;
    const st = statusBySlot.get(activeSlotId);
    if (st && st.status === "pending") {
      updateExerciseStatus({
        sessionId: session.id,
        templateSlotId: activeSlotId,
        status: "in_progress",
        startedAt: new Date(),
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlotId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (slotsWithExercise.length === 0) return;
      const detected = await analyzeSessionPatterns(
        slotsWithExercise.map((s) => ({ id: s.id, exercise_id: s.exercise_id, block: s.block })),
        slotsWithExercise.map((s) => ({
          id: s.exercise_id,
          name: s.exercise.name,
          equipment: s.exercise.equipment ? { name: s.exercise.equipment.name } : null,
        }))
      );
      if (!cancelled) setPatterns(detected);
    })();
    return () => {
      cancelled = true;
    };
  }, [slotsWithExercise]);

  const voiceContext = useMemo(() => {
    const byName = new Map<string, string>();
    const entries: VoiceContextExercise[] = slotsWithExercise.map((slot) => {
      byName.set(slot.exercise.name, slot.exercise_id);
      return {
        name: slot.exercise.name,
        unit: slot.exercise.unit as VoiceContextExercise["unit"],
        loadOptions:
          slot.exercise.unit === "kg"
            ? resolveAvailableLoads((slot.exercise.equipment as EquipmentLoadConfig | undefined) ?? NO_EQUIPMENT)
            : undefined,
      };
    });
    return { entries, byName };
  }, [slotsWithExercise]);

  function handleVoiceParsed(sets: VoiceParsedSet[]) {
    setVoiceMatches((prev) => {
      const next = { ...prev };
      const ts = Date.now();
      for (const set of sets) {
        const exerciseId = voiceContext.byName.get(set.exercise);
        if (!exerciseId) continue;
        next[exerciseId] = { load: set.load_kg, reps: set.reps, rpe: set.rpe, ts };
      }
      return next;
    });
  }

  function advanceToNext(fromSlotId: string) {
    const order = executionOrder ?? defaultOrder;
    const idx = order.indexOf(fromSlotId);
    const rest = idx >= 0 ? order.slice(idx + 1) : order;
    const next = rest.find((id) => {
      const st = statusBySlot.get(id)?.status ?? "pending";
      return st === "pending" || st === "in_progress";
    });
    setActiveSlotId(next ?? null);
  }

  async function handleExerciseComplete(slot: SlotWithExercise) {
    await updateExerciseStatus({
      sessionId: session.id,
      templateSlotId: slot.id,
      status: "completed",
      setsCompleted: slot.sets ?? 1,
      completedAt: new Date(),
    });
    advanceToNext(slot.id);
  }

  function handleNavigate(targetSlotId: string) {
    if (activeSlotId && activeSlotId !== targetSlotId) {
      const prevStatus = statusBySlot.get(activeSlotId)?.status;
      if (prevStatus === "in_progress") {
        const proceed = confirm("¿Dejás este ejercicio a medias para volver después?");
        if (!proceed) return;
        updateExerciseStatus({ sessionId: session.id, templateSlotId: activeSlotId, status: "partial" }).catch(() => {});
      }
    }
    setActiveSlotId(targetSlotId);
  }

  function handleReorder(newPendingOrder: string[]) {
    setExecutionOrder((prev) => {
      const base = prev ?? slotsWithExercise.map((s) => s.id);
      const pendingSet = new Set(newPendingOrder);
      let cursor = 0;
      return base.map((id) => (pendingSet.has(id) ? newPendingOrder[cursor++] : id));
    });
  }

  const skipTarget = skipTargetSlotId ? slotsWithExercise.find((s) => s.id === skipTargetSlotId) : undefined;
  const skipTargetLogs = useLiveQuery(
    async () => {
      if (!skipTarget) return [];
      const all = await db.set_logs.where("session_id").equals(session.id).toArray();
      return all.filter((l) => l.template_slot_id === skipTarget.id && l._deleted !== 1);
    },
    [skipTarget?.id, session.id],
    []
  );

  async function handleSkip(reason: SkipReason, note?: string) {
    if (!skipTargetSlotId) return;
    await updateExerciseStatus({
      sessionId: session.id,
      templateSlotId: skipTargetSlotId,
      status: "skipped",
      skipReason: reason,
      skipNote: note ?? null,
      setsCompleted: skipTargetLogs.length,
      completedAt: new Date(),
    });
    const skippedId = skipTargetSlotId;
    setSkipTargetSlotId(null);
    if (activeSlotId === skippedId) advanceToNext(skippedId);
  }

  async function handleMarkPartial() {
    if (!skipTargetSlotId) return;
    await updateExerciseStatus({
      sessionId: session.id,
      templateSlotId: skipTargetSlotId,
      status: "partial",
      setsCompleted: skipTargetLogs.length,
      completedAt: new Date(),
    });
    const partialId = skipTargetSlotId;
    setSkipTargetSlotId(null);
    if (activeSlotId === partialId) advanceToNext(partialId);
  }

  async function handleFinish() {
    setFinishing(true);
    try {
      const allLogs = await db.set_logs.where("session_id").equals(session.id).toArray();
      const now = nowIso();
      const summary: SessionSummary[] = [];

      // Fase 1: el e1RM es una propiedad del movimiento, no del propósito de
      // entrenamiento — se actualiza una sola vez por ejercicio, combinando
      // TODAS las series logueadas esta sesión sin importar en qué slot.
      const exerciseIds = Array.from(new Set(allLogs.map((l) => l.exercise_id)));
      const e1rmByExercise = new Map<string, { oldE1rm: number | null; newE1rm: number; updated: boolean }>();

      for (const exerciseId of exerciseIds) {
        const exercise = await db.exercises.get(exerciseId);
        if (!exercise || exercise.unit !== "kg") continue;
        const sets = allLogs
          .filter(
            (l) =>
              l.exercise_id === exerciseId &&
              l._deleted !== 1 &&
              l.actual_load_kg != null &&
              l.actual_reps != null &&
              l.rpe_reported != null
          )
          .map((l) => ({ load: l.actual_load_kg!, reps: l.actual_reps!, rpe: l.rpe_reported! }));
        if (sets.length === 0) continue;

        const oldE1rm = exercise.e1rm_kg;
        const { e1rm, updated } = updateE1rm(exercise, sets);

        if (updated) {
          await db.exercises.update(exerciseId, { e1rm_kg: e1rm, updated_at: now, _dirty: 1 });
          await db.e1rm_estimates.put({
            id: newId(),
            user_id: userId,
            created_at: now,
            updated_at: now,
            exercise_id: exerciseId,
            date: todayIso(),
            e1rm_kg: e1rm,
            method: "epley_rpe",
            source_session_id: session.id,
            _dirty: 1,
            _deleted: 0,
          });
        }
        e1rmByExercise.set(exerciseId, { oldE1rm, newE1rm: e1rm, updated });
      }

      // Fase 2: la sugerencia de carga (o la marca a batir) es por SLOT — cada
      // ocurrencia del ejercicio puede tener un propósito distinto (fuerza vs
      // volumen) y merece su propia recomendación y su propio historial de
      // patrones, aunque comparta el e1RM calculado arriba.
      const loggedSlotIds = new Set(allLogs.filter((l) => l._deleted !== 1).map((l) => l.template_slot_id));
      const slotsWithLogs = slotsWithExercise.filter((s) => loggedSlotIds.has(s.id));
      const slotsPerExercise = new Map<string, number>();
      for (const s of slotsWithLogs) {
        slotsPerExercise.set(s.exercise_id, (slotsPerExercise.get(s.exercise_id) ?? 0) + 1);
      }

      for (const slot of slotsWithLogs) {
        const exercise = await db.exercises.get(slot.exercise_id);
        if (!exercise) continue;

        const skipHistory = await getSkipHistory(slot.id, 6);
        const detected = detectSkipPatterns(skipHistory, {
          slotId: slot.id,
          exerciseId: slot.exercise_id,
          exerciseName: exercise.name,
        });
        const chronicPartial = detected.some((p) => p.type === "chronic_partial");
        const recentPhysicalDiscomfort = detected.some((p) => p.type === "physical_concern");
        const slotLabel = (slotsPerExercise.get(slot.exercise_id) ?? 0) > 1 ? schemeLabel(slot) : null;

        if (exercise.category === "conditioning") {
          const cardioLogs = allLogs
            .filter((l) => l.template_slot_id === slot.id && l._deleted !== 1 && l.actual_duration_seconds != null)
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
          if (cardioLogs.length === 0) continue;

          const actualSeconds = cardioLogs[0].actual_duration_seconds!;
          const targetSeconds = slot.target_duration_seconds;
          summary.push({
            kind: "cardio",
            exerciseName: exercise.name,
            slotLabel,
            targetSeconds,
            actualSeconds,
            status: targetSeconds != null ? classifyCardio(actualSeconds, targetSeconds) : null,
          });
        } else if (exercise.unit === "kg") {
          const e1rmResult = e1rmByExercise.get(slot.exercise_id);
          if (!e1rmResult) continue; // sin series válidas para e1RM (rpe/reps/carga faltantes)

          const slotSets = allLogs
            .filter(
              (l) =>
                l.template_slot_id === slot.id &&
                l._deleted !== 1 &&
                l.actual_load_kg != null &&
                l.actual_reps != null &&
                l.rpe_reported != null
            )
            .map((l) => ({ load: l.actual_load_kg!, reps: l.actual_reps!, rpe: l.rpe_reported! }));
          if (slotSets.length === 0) continue;

          let suggestion: LoadSuggestion | null = null;
          if (slot.reps != null && slot.rpe_target != null) {
            const equipmentConfig = (slot.exercise.equipment as EquipmentLoadConfig | undefined) ?? NO_EQUIPMENT;
            suggestion = suggestNextLoad(
              { target_reps: slot.reps, target_rpe: slot.rpe_target, last_session_sets: slotSets, readiness: session.readiness },
              equipmentConfig,
              { recentPhysicalDiscomfort }
            );
          }
          const setsNote = slot.sets != null ? adjustPlannedSets(slot.sets, chronicPartial).note : null;

          summary.push({
            kind: "load",
            exerciseName: exercise.name,
            slotLabel,
            oldE1rm: e1rmResult.oldE1rm,
            newE1rm: e1rmResult.newE1rm,
            e1rmUpdated: e1rmResult.updated,
            suggestion,
            setsNote,
          });
        } else {
          const repsHistory = (await db.set_logs.where("template_slot_id").equals(slot.id).toArray())
            .filter((l) => l._deleted !== 1 && l.actual_reps != null)
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((l) => l.actual_reps!);
          const { target, isPR } = suggestNextTarget(repsHistory);
          summary.push({ kind: "nonload", exerciseName: exercise.name, slotLabel, unit: exercise.unit, target, isPR });
        }
      }

      const finalStatuses = await getSessionExerciseStatuses(session.id);
      const exerciseNameById = new Map(slotsWithExercise.map((s) => [s.exercise_id, s.exercise.name]));
      const finalPatterns = await analyzeSessionPatterns(
        slotsWithExercise.map((s) => ({ id: s.id, exercise_id: s.exercise_id, block: s.block })),
        slotsWithExercise.map((s) => ({
          id: s.exercise_id,
          name: s.exercise.name,
          equipment: s.exercise.equipment ? { name: s.exercise.equipment.name } : null,
        }))
      );
      const patternSlotIds = new Set(finalPatterns.map((p) => p.slotId));
      const slotById = new Map(slotsWithExercise.map((s) => [s.id, s]));

      const omitted: OmittedExerciseSummary[] = finalStatuses
        .filter((s) => s.status === "partial" || s.status === "skipped")
        .map((s) => {
          const slot = slotById.get(s.template_slot_id);
          // R-4: candidatos "alternativa" = mismo bloque, distinto ejercicio,
          // deduplicados (un ejercicio puede repetirse en más de un slot).
          const alternativeCandidates = slot
            ? Array.from(
                new Map(
                  slotsWithExercise
                    .filter((other) => other.block === slot.block && other.exercise_id !== s.exercise_id)
                    .map((other) => [other.exercise_id, { id: other.exercise_id, name: other.exercise.name }])
                ).values()
              )
            : [];

          return {
            id: s.id,
            exerciseId: s.exercise_id,
            exerciseName: exerciseNameById.get(s.exercise_id) ?? "Ejercicio",
            templateSlotId: s.template_slot_id,
            status: s.status as "partial" | "skipped",
            skipReason: (s.skip_reason as SkipReason | null) ?? null,
            skipNote: s.skip_note,
            setsCompleted: s.sets_completed,
            setsPlanned: s.sets_planned,
            hasPattern: patternSlotIds.has(s.template_slot_id),
            alternativeCandidates,
          };
        });

      const plannedSets = finalStatuses.reduce((a, s) => a + s.sets_planned, 0);
      const completedSets = finalStatuses.reduce((a, s) => a + s.sets_completed, 0);
      const volumeCompletion = {
        plannedSets,
        completedSets,
        pct: plannedSets > 0 ? Math.round((completedSets / plannedSets) * 100) : 100,
      };

      if (estimate) {
        const actualSeconds = (Date.now() - sessionStart.getTime()) / 1000;
        const variancePct =
          estimate.estimatedTotalSeconds > 0
            ? Math.round(((actualSeconds - estimate.estimatedTotalSeconds) / estimate.estimatedTotalSeconds) * 1000) / 10
            : null;
        await db.sessions.update(session.id, { session_duration_variance_pct: variancePct, updated_at: nowIso(), _dirty: 1 });
      }

      onFinish({ summary, omitted, volumeCompletion });
    } finally {
      setFinishing(false);
    }
  }

  const activeSlot = activeSlotId ? slotsWithExercise.find((s) => s.id === activeSlotId) : undefined;
  const firstSlot = slotsWithExercise[0];
  const techniqueSheetSlot = !techniqueAcknowledged ? firstSlot : undefined;
  const progress = estimate
    ? getSessionProgress(
        estimate,
        navigatorExercises.filter((e) => e.status === "completed").map((e) => e.slotId),
        navigatorExercises.filter((e) => e.status === "skipped").map((e) => e.slotId),
        sessionStart
      )
    : null;
  // Índice dentro del orden de ejecución real (no slot_order): si se
  // priorizó un ejercicio ("mover al inicio"), su posición mostrada debe
  // reflejar que va primero, no su slot_order original.
  const currentOrder = executionOrder ?? defaultOrder;
  const activeIndex = activeSlot ? currentOrder.indexOf(activeSlot.id) : -1;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Sesión de hoy</h1>
        <SyncStatus />
      </div>

      {voiceContext.entries.length > 0 && <VoiceCapture contexto={voiceContext.entries} onParsed={handleVoiceParsed} />}

      {activeSlot ? (
        <>
          <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
            <span>
              Ejercicio {activeIndex + 1} de {navigatorExercises.length}
            </span>
            <button
              type="button"
              onClick={() => setSkipTargetSlotId(activeSlot.id)}
              className="min-h-11 rounded-lg border border-zinc-300 px-3 text-sm dark:border-zinc-700"
            >
              ⏭ Omitir ejercicio
            </button>
          </div>
          <SlotCard
            slot={activeSlot}
            sessionId={session.id}
            userId={userId}
            voicePrefill={voiceMatches[activeSlot.exercise_id]}
            objective={getObjectiveFromSlot(activeSlot, activeSlot.exercise.unit)}
            onExerciseComplete={() => handleExerciseComplete(activeSlot)}
          />
        </>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">
            {slotsWithExercise.length === 0 ? "Esta plantilla no tiene ejercicios." : "¡Completaste todos los ejercicios!"}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleFinish}
        disabled={finishing}
        className="rounded-lg bg-zinc-900 px-4 py-3 text-center font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {finishing ? "Cerrando…" : "Finalizar sesión"}
      </button>

      {techniqueSheetSlot && (
        <TechniqueSheet
          exerciseName={techniqueSheetSlot.exercise.name}
          biomechNote={techniqueSheetSlot.exercise.biomech_note}
          onAcknowledge={() => setTechniqueAcknowledged(true)}
        />
      )}

      {skipTarget && (
        <SkipModal
          exerciseName={skipTarget.exercise.name}
          setsCompleted={skipTargetLogs.length}
          setsPlanned={skipTarget.sets ?? 1}
          onSkip={handleSkip}
          onCancel={() => setSkipTargetSlotId(null)}
          onMarkPartial={handleMarkPartial}
        />
      )}

      {slotsWithExercise.length > 0 && (
        <SessionNavigator
          exercises={navigatorExercises}
          activeSlotId={activeSlotId}
          executionOrder={executionOrder ?? defaultOrder}
          remainingMinutes={progress ? Math.round(progress.estimatedRemainingSeconds / 60) : 0}
          onNavigate={handleNavigate}
          onRequestSkip={(id) => setSkipTargetSlotId(id)}
          onReorder={handleReorder}
          onFinishSession={handleFinish}
        />
      )}

      {patterns.length > 0 && null /* las alertas pre-sesión ya se muestran en SessionBriefing */}
    </div>
  );
}
