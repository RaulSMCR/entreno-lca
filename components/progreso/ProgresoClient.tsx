"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { pullRemote } from "@/lib/sync";
import { todayIso } from "@/lib/date";
import { SyncStatus } from "@/components/SyncStatus";
import { averageRpePerSession, weeklyVolume } from "@/lib/progress";
import { ExerciseProgressCard } from "./ExerciseProgressCard";

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
    () => db.exercises.toCollection().filter((e) => e.block === "principal" && e.is_active !== false).toArray(),
    [],
    []
  );
  const estimates = useLiveQuery(() => db.e1rm_estimates.toArray(), [], []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], []);
  const setLogs = useLiveQuery(() => db.set_logs.toArray(), [], []);

  const since = daysAgoIso(7);
  const recentSessions = (sessions ?? []).filter((s) => s.date >= since && s._deleted !== 1);
  const recentSessionIds = new Set(recentSessions.map((s) => s.id));
  const recentLogs = (setLogs ?? []).filter((l) => recentSessionIds.has(l.session_id) && l._deleted !== 1);

  const volume = weeklyVolume(recentLogs.map((l) => ({ load: l.actual_load_kg, reps: l.actual_reps })));
  const sessionDates = Object.fromEntries(recentSessions.map((s) => [s.id, s.date]));
  const rpeBySession = averageRpePerSession(recentLogs, sessionDates);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Progreso</h1>
        <SyncStatus />
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

      {(exercises ?? []).map((ex) => (
        <ExerciseProgressCard
          key={ex.id}
          exercise={ex}
          estimates={(estimates ?? []).filter((e) => e.exercise_id === ex.id)}
        />
      ))}

      {exercises && exercises.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No hay ejercicios principales todavía.</p>
      )}
    </div>
  );
}
