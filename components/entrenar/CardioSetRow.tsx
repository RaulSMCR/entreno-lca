"use client";

import { useEffect, useRef, useState } from "react";
import { db, newId, nowIso, type LocalSetLog } from "@/lib/db";

// Igual que en SetRow.tsx — duplicado a propósito (mismo criterio ya usado en
// el resto del código para constantes chicas).
const RPE_STEPS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

type CardioStatus = "short" | "met" | "exceeded";

const STATUS_LABEL: Record<CardioStatus, string> = {
  short: "Corta",
  met: "Cumplida",
  exceeded: "Superada",
};

const STATUS_STYLE: Record<CardioStatus, string> = {
  short: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
  met: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
  exceeded: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100",
};

// Heurístico documentado y reemplazable (mismo criterio que
// getObjectiveFromSlot en training-theory.ts): ±10% de la meta se considera
// "cumplida"; por debajo, corta; por encima, superada.
function classify(actualSeconds: number, targetSeconds: number): CardioStatus {
  if (actualSeconds < targetSeconds * 0.9) return "short";
  if (actualSeconds > targetSeconds * 1.1) return "exceeded";
  return "met";
}

function formatMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CardioSetRow({
  sessionId,
  userId,
  exerciseId,
  templateSlotId,
  setNumber,
  targetSeconds,
  existing,
}: {
  sessionId: string;
  userId: string;
  exerciseId: string;
  /** template_slots.id — ver nota en SetRow.tsx. */
  templateSlotId: string;
  setNumber: number;
  targetSeconds: number | null;
  existing: LocalSetLog | undefined;
}) {
  const [editing, setEditing] = useState(!existing);
  const [elapsed, setElapsed] = useState(existing?.actual_duration_seconds ?? 0);
  const [running, setRunning] = useState(false);
  const [rpe, setRpe] = useState<number | null>(existing?.rpe_reported ?? null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function toggleStopwatch() {
    if (running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRunning(false);
      return;
    }
    setElapsed(0);
    const start = Date.now();
    intervalRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - start) / 1000));
    }, 250);
    setRunning(true);
  }

  async function save() {
    const now = nowIso();
    const row: LocalSetLog = {
      id: existing?.id ?? newId(),
      user_id: userId,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      session_id: sessionId,
      exercise_id: exerciseId,
      template_slot_id: templateSlotId,
      set_number: setNumber,
      target_load_kg: null,
      actual_load_kg: null,
      target_reps: null,
      actual_reps: null,
      actual_duration_seconds: elapsed,
      rpe_reported: rpe,
      rpe_at_rep: null,
      is_failure: false,
      note: null,
      side: null,
      rom_rpe: null,
      posture_ok: null,
      synced_from_local: true,
      _dirty: 1,
      _deleted: 0,
    };
    await db.set_logs.put(row);
    setEditing(false);
  }

  if (!editing && existing) {
    const existingSeconds = existing.actual_duration_seconds ?? 0;
    const existingStatus = targetSeconds != null ? classify(existingSeconds, targetSeconds) : null;
    return (
      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950">
        <span>
          Serie {setNumber}: {formatMMSS(existingSeconds)}
          {existingStatus ? ` · ${STATUS_LABEL[existingStatus]}` : ""}
          {existing.rpe_reported != null ? ` · RPE ${existing.rpe_reported}` : ""}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-11 px-2 text-zinc-500 dark:text-zinc-400"
        >
          Editar
        </button>
      </div>
    );
  }

  const status = targetSeconds != null && elapsed > 0 ? classify(elapsed, targetSeconds) : null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-900 dark:text-zinc-50">Serie {setNumber}</span>
        <span className="text-zinc-500 dark:text-zinc-400">
          {targetSeconds != null ? `Meta ${formatMMSS(targetSeconds)}` : "Sin meta definida"}
        </span>
      </div>

      <div className="flex flex-col items-center gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        <span className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
          {formatMMSS(elapsed)}
        </span>
        <button
          type="button"
          onClick={toggleStopwatch}
          className="min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700"
        >
          {running ? "Detener" : "Iniciar"} cronómetro
        </button>
        {!running && status && (
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_STYLE[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="RPE percibido">
        {RPE_STEPS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={rpe === r ? "true" : "false"}
            aria-label={`RPE ${r}`}
            onClick={() => setRpe(r)}
            className={`min-h-11 min-w-11 rounded-lg border px-3 py-2 text-sm ${
              rpe === r
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={running || elapsed === 0}
        aria-label="Guardar serie"
        className="min-h-11 rounded-lg bg-emerald-600 px-4 py-3 text-center text-lg font-semibold text-white disabled:opacity-50"
      >
        ✓
      </button>
    </div>
  );
}
