"use client";

import type { SessionSummary } from "./WorkoutSetFlow";
import { SyncStatus } from "@/components/SyncStatus";
import { db } from "@/lib/db";
import { buildHistoryRows, downloadHistoryAsCsv, downloadHistoryAsJson } from "@/lib/export";
import type { SkipReason } from "@/lib/session-exercise";

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
  status: "partial" | "skipped";
  skipReason: SkipReason | null;
  skipNote: string | null;
  setsCompleted: number;
  setsPlanned: number;
  hasPattern: boolean;
};

export function ResumenView({
  summary,
  sessionId,
  sessionDate,
  onClose,
  omitted = [],
  volumeCompletion,
}: {
  summary: SessionSummary[];
  sessionId: string | null;
  sessionDate: string;
  onClose: () => void;
  omitted?: OmittedExerciseSummary[];
  volumeCompletion?: { completedSets: number; plannedSets: number; pct: number };
}) {
  async function exportSession(format: "csv" | "json") {
    if (!sessionId) return;
    const logs = await db.set_logs.where("session_id").equals(sessionId).toArray();
    const exerciseIds = Array.from(new Set(logs.map((l) => l.exercise_id)));
    const exercises = await db.exercises.bulkGet(exerciseIds);
    const exerciseNames = Object.fromEntries(exercises.filter((e) => e != null).map((e) => [e.id, e.name]));
    const rows = buildHistoryRows(logs, { [sessionId]: sessionDate }, exerciseNames);
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
        className="rounded-lg bg-zinc-900 px-4 py-3 text-center font-medium text-white dark:bg-zinc-50 dark:text-zinc-900 print:hidden"
      >
        Listo
      </button>
    </div>
  );
}
