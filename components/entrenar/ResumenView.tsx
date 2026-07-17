"use client";

import { useState } from "react";
import type { SessionSummary } from "./WorkoutSetFlow";
import { AlternativeExercisePanel, type AlternativeCandidate } from "./AlternativeExercisePanel";
import { SyncStatus } from "@/components/SyncStatus";
import { db, type LocalTemplateSlot } from "@/lib/db";
import { buildHistoryRows, downloadHistoryAsCsv, downloadHistoryAsJson } from "@/lib/export";
import { updateExerciseStatus, type SkipReason } from "@/lib/session-exercise";
import { StrengthLevelUpdate } from "@/components/perfil/StrengthLevelUpdate";

// Igual que en SlotCard.tsx — se duplica acá a propósito (misma convención
// ya usada en el resto del código) en vez de acoplar un componente de export
// a otro de UI solo por esta función de 8 líneas.
function schemeLabel(slot: LocalTemplateSlot): string {
  if (slot.block === "principal") {
    const parts: string[] = [];
    if (slot.sets != null && slot.reps != null) parts.push(`${slot.sets}×${slot.reps}`);
    if (slot.pct_max != null) parts.push(`${slot.pct_max}%`);
    if (slot.rpe_target != null) parts.push(`RPE ${slot.rpe_target}`);
    return parts.join(" · ");
  }
  const parts: string[] = [];
  if (slot.reps_or_time) parts.push(slot.reps_or_time);
  if (slot.intensity_note) parts.push(slot.intensity_note);
  return parts.join(" · ");
}

const ACTION_LABEL: Record<string, string> = {
  increase: "Subí",
  maintain: "Mantené",
  repeat: "Repetí",
  decrease: "Bajá",
};

const ACTION_STYLE: Record<string, string> = {
  increase: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
  maintain: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100",
  repeat: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
  decrease: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
};

// Igual que en CardioSetRow.tsx — duplicado a propósito (mismo criterio ya
// usado en el resto del código para constantes chicas).
const CARDIO_STATUS_LABEL: Record<"short" | "met" | "exceeded", string> = {
  short: "Corta",
  met: "Cumplida",
  exceeded: "Superada",
};

const CARDIO_STATUS_STYLE: Record<"short" | "met" | "exceeded", string> = {
  short: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
  met: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
  exceeded: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100",
};

function formatMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  station_occupied: "Estación ocupada",
  equipment_unavailable: "Equipo no disponible",
  physical_discomfort: "Molestia física registrada",
  no_time: "Sin tiempo",
  other: "Otro motivo",
};

export type OmittedExerciseSummary = {
  /** session_exercise_statuses.id — exerciseId no es único por sesión: un
   *  mismo ejercicio puede repetirse en más de un slot de la plantilla. */
  id: string;
  exerciseId: string;
  exerciseName: string;
  templateSlotId: string;
  status: "partial" | "skipped";
  skipReason: SkipReason | null;
  skipNote: string | null;
  setsCompleted: number;
  setsPlanned: number;
  hasPattern: boolean;
  /** R-4: candidatos del mismo bloque en la plantilla, para "buscar alternativa". */
  alternativeCandidates: AlternativeCandidate[];
};

export function ResumenView({
  summary,
  sessionId,
  sessionDate,
  onClose,
  omitted = [],
  volumeCompletion,
  userId,
}: {
  summary: SessionSummary[];
  sessionId: string | null;
  sessionDate: string;
  onClose: () => void;
  omitted?: OmittedExerciseSummary[];
  volumeCompletion?: { completedSets: number; plannedSets: number; pct: number };
  userId: string;
}) {
  const [alternativesFor, setAlternativesFor] = useState<OmittedExerciseSummary | null>(null);

  async function suggestAlternative(item: OmittedExerciseSummary, candidateName: string | null) {
    if (!sessionId) return;
    const note = candidateName
      ? `Sugerencia: reemplazar por "${candidateName}"`
      : "Sugerido buscar un ejercicio alternativo";
    const combinedNote = item.skipNote ? `${item.skipNote} · ${note}` : note;
    await updateExerciseStatus({
      sessionId,
      templateSlotId: item.templateSlotId,
      status: item.status,
      skipNote: combinedNote,
    });
  }

  async function exportSession(format: "csv" | "json") {
    if (!sessionId) return;
    const logs = await db.set_logs.where("session_id").equals(sessionId).toArray();
    const exerciseIds = Array.from(new Set(logs.map((l) => l.exercise_id)));
    const exercises = await db.exercises.bulkGet(exerciseIds);
    const exerciseNames = Object.fromEntries(exercises.filter((e) => e != null).map((e) => [e.id, e.name]));

    const slotIds = Array.from(new Set(logs.map((l) => l.template_slot_id)));
    const slots = await db.template_slots.bulkGet(slotIds);
    const slotSchemes = Object.fromEntries(
      slots.filter((s) => s != null).map((s) => [s.id, schemeLabel(s)])
    );

    const rows = buildHistoryRows(logs, { [sessionId]: sessionDate }, exerciseNames, slotSchemes);
    if (format === "csv") downloadHistoryAsCsv(`sesion-${sessionDate}.csv`, rows);
    else downloadHistoryAsJson(`sesion-${sessionDate}.json`, rows);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24 print:pb-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Resumen de la sesión</h1>
        <SyncStatus />
      </div>
      <h1 className="hidden text-xl font-semibold text-black print:block">Resumen de la sesión — {sessionDate}</h1>

      {summary.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No se registró ninguna serie en esta sesión.</p>
      )}

      {omitted.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="font-medium text-amber-900 dark:text-amber-100">Ejercicios omitidos</p>
          {volumeCompletion && (
            <p className="text-sm text-amber-900 dark:text-amber-100">
              Volumen completado: {volumeCompletion.pct}% del plan ({volumeCompletion.completedSets} de{" "}
              {volumeCompletion.plannedSets} series)
            </p>
          )}
          <div className="flex flex-col gap-2">
            {omitted.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <span className="font-medium text-amber-900 dark:text-amber-100">{o.exerciseName}</span>
                  <span className="text-amber-800 dark:text-amber-200">
                    {" "}
                    · {o.status === "partial" ? `${o.setsCompleted}/${o.setsPlanned} series` : "omitido"}
                    {o.skipReason ? ` · ${SKIP_REASON_LABEL[o.skipReason]}` : ""}
                  </span>
                  {o.skipNote && <p className="text-xs text-amber-800 dark:text-amber-200">“{o.skipNote}”</p>}
                  {o.hasPattern && (
                    <button
                      type="button"
                      onClick={() => setAlternativesFor(o)}
                      className="mt-1 block text-xs font-medium text-amber-900 underline dark:text-amber-100"
                    >
                      Buscar ejercicio alternativo
                    </button>
                  )}
                </div>
                {o.hasPattern && (
                  <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                    ⚠️ Patrón detectado
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.map((item, i) => (
        <div
          key={i}
          className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <p className="font-medium text-zinc-900 dark:text-zinc-50">{item.exerciseName}</p>
          {item.slotLabel && <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.slotLabel}</p>}

          {item.kind === "load" ? (
            <>
              {item.e1rmUpdated ? (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  e1RM: {item.oldE1rm ?? "—"}kg → {item.newE1rm.toFixed(1)}kg
                </p>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">e1RM sin cambios ({item.oldE1rm ?? "—"}kg)</p>
              )}
              {item.suggestion && (
                <div className={`mt-1 rounded-xl border px-3 py-2 ${ACTION_STYLE[item.suggestion.action] ?? ""}`}>
                  <p className="font-semibold">
                    {ACTION_LABEL[item.suggestion.action] ?? item.suggestion.action} a {item.suggestion.real}kg
                  </p>
                  <p className="text-sm opacity-90">{item.suggestion.reason}</p>
                </div>
              )}
              {item.setsNote && <p className="text-sm text-amber-700 dark:text-amber-400">{item.setsNote}</p>}
              {item.e1rmUpdated && (
                <StrengthLevelUpdate
                  userId={userId}
                  exerciseName={item.exerciseName}
                  oldE1rmKg={item.oldE1rm}
                  newE1rmKg={item.newE1rm}
                />
              )}
            </>
          ) : item.kind === "cardio" ? (
            <>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                {formatMMSS(item.actualSeconds)}
                {item.targetSeconds != null && ` de ${formatMMSS(item.targetSeconds)} de meta`}
                {item.reading != null && ` · ${item.reading} (lectura de la máquina)`}
              </p>
              {item.status && (
                <span
                  className={`mt-1 inline-block w-fit rounded-full border px-3 py-1 text-xs font-medium ${CARDIO_STATUS_STYLE[item.status]}`}
                >
                  {CARDIO_STATUS_LABEL[item.status]}
                </span>
              )}
            </>
          ) : (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Objetivo a batir: {item.target} {item.unit}
              {item.isPR && <span className="ml-2 font-medium text-emerald-600 dark:text-emerald-400">¡PR! 🏆</span>}
            </p>
          )}
        </div>
      ))}

      {sessionId && summary.length > 0 && (
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={() => exportSession("csv")}
            className="h-11 flex-1 rounded-lg border border-zinc-300 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => exportSession("json")}
            className="h-11 flex-1 rounded-lg border border-zinc-300 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            Exportar JSON
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-11 flex-1 rounded-lg border border-zinc-300 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            Imprimir
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        className="rounded-lg bg-accent-600 px-4 py-3 text-center font-medium text-brand-950 print:hidden"
      >
        Listo
      </button>

      {alternativesFor && (
        <AlternativeExercisePanel
          exerciseName={alternativesFor.exerciseName}
          candidates={alternativesFor.alternativeCandidates}
          onClose={() => setAlternativesFor(null)}
          onSuggestToTrainer={(candidateName) => suggestAlternative(alternativesFor, candidateName)}
        />
      )}
    </div>
  );
}
