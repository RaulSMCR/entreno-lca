"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { pullRemote } from "@/lib/sync";
import { todayIso } from "@/lib/date";
import { SyncStatus } from "@/components/SyncStatus";
import { averageRpePerSession, rpeDistribution, weeklyVolume, weeklyVolumeSeries } from "@/lib/progress";
import { buildHistoryRows, downloadHistoryAsCsv, downloadHistoryAsJson } from "@/lib/export";
import { ExerciseProgressCard } from "./ExerciseProgressCard";
import { WeeklyVolumeChart } from "./WeeklyVolumeChart";
import { RpeDistributionChart } from "./RpeDistributionChart";
import type { LocalTemplateSlot } from "@/lib/db";

const VOLUME_WEEKS = 8;

// Igual que en SlotCard.tsx — duplicado a propósito (misma convención usada
// en el resto del código para esta función chica).
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

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ProgresoClient() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      pullRemote().catch(() => {});
    }
  }, []);

  const exercises = useLiveQuery(
    () =>
      db.exercises
        .toCollection()
        .filter((e) => e.block === "principal" && e.unit === "kg" && e.is_active !== false)
        .toArray(),
    [],
    []
  );
  const allExercises = useLiveQuery(() => db.exercises.toArray(), [], []);
  const estimates = useLiveQuery(() => db.e1rm_estimates.toArray(), [], []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], []);
  const setLogs = useLiveQuery(() => db.set_logs.toArray(), [], []);

  const since = daysAgoIso(7);
  const activeSessions = (sessions ?? []).filter((s) => s._deleted !== 1);
  const sessionDatesAll = Object.fromEntries(activeSessions.map((s) => [s.id, s.date]));
  const activeLogs = (setLogs ?? []).filter((l) => l._deleted !== 1);

  const recentSessions = activeSessions.filter((s) => s.date >= since);
  const recentSessionIds = new Set(recentSessions.map((s) => s.id));
  const recentLogs = activeLogs.filter((l) => recentSessionIds.has(l.session_id));

  const volume = weeklyVolume(recentLogs.map((l) => ({ load: l.actual_load_kg, reps: l.actual_reps })));
  const rpeBySession = averageRpePerSession(recentLogs, sessionDatesAll);

  const sinceVolumeWindow = daysAgoIso(VOLUME_WEEKS * 7);
  const windowLogs = activeLogs.filter((l) => (sessionDatesAll[l.session_id] ?? "") >= sinceVolumeWindow);
  const volumeSeries = weeklyVolumeSeries(
    windowLogs.map((l) => ({ load: l.actual_load_kg, reps: l.actual_reps, date: sessionDatesAll[l.session_id] ?? "" })),
    VOLUME_WEEKS
  );
  const rpeBuckets = rpeDistribution(windowLogs.map((l) => l.rpe_reported).filter((r): r is number => r != null));

  async function exportHistory(format: "csv" | "json") {
    const exerciseNames = Object.fromEntries((allExercises ?? []).map((e) => [e.id, e.name]));
    const slotIds = Array.from(new Set(activeLogs.map((l) => l.template_slot_id)));
    const slots = await db.template_slots.bulkGet(slotIds);
    const slotSchemes = Object.fromEntries(slots.filter((s) => s != null).map((s) => [s.id, schemeLabel(s)]));

    const rows = buildHistoryRows(activeLogs, sessionDatesAll, exerciseNames, slotSchemes);
    if (format === "csv") downloadHistoryAsCsv("historial-entreno-lca.csv", rows);
    else downloadHistoryAsJson("historial-entreno-lca.json", rows);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Progreso</h1>
        <SyncStatus />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => exportHistory("csv")}
          className="h-11 flex-1 rounded-lg border border-zinc-300 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Exportar historial CSV
        </button>
        <button
          type="button"
          onClick={() => exportHistory("json")}
          className="h-11 flex-1 rounded-lg border border-zinc-300 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Exportar historial JSON
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="font-medium text-zinc-900 dark:text-zinc-50">Esta semana</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Volumen total: {volume.toFixed(0)}kg</p>
        {rpeBySession.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            {rpeBySession.map((s) => (
              <li key={s.sessionId}>
                {s.date === todayIso() ? "Hoy" : s.date}: RPE medio {s.avgRpe.toFixed(1)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-400">Sin sesiones registradas esta semana.</p>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="font-medium text-zinc-900 dark:text-zinc-50">Volumen semanal</p>
        <WeeklyVolumeChart data={volumeSeries} />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="font-medium text-zinc-900 dark:text-zinc-50">Distribución de RPE</p>
        <RpeDistributionChart data={rpeBuckets} />
      </div>

      {(exercises ?? []).map((ex) => {
        const exerciseLogs = activeLogs.filter((l) => l.exercise_id === ex.id);
        const recentRpeAvgs = averageRpePerSession(exerciseLogs, sessionDatesAll)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((r) => r.avgRpe);
        return (
          <ExerciseProgressCard
            key={ex.id}
            exercise={ex}
            estimates={(estimates ?? []).filter((e) => e.exercise_id === ex.id)}
            recentRpeAvgs={recentRpeAvgs}
          />
        );
      })}

      {exercises && exercises.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No hay ejercicios principales todavía.</p>
      )}
    </div>
  );
}
