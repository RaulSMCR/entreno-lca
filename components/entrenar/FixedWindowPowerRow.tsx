"use client";

import { useEffect, useRef, useState } from "react";
import { db, newId, nowIso, type LocalSetLog } from "@/lib/db";

const RPE_STEPS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

// potencia_tiempo_fijo (hoy solo "Slam Ball Sentado"): reps a máxima
// velocidad dentro de una ventana fija (countdown), con carga fija
// prellenada desde exercises.rm_base_kg. RPE general del intento sí — no
// a-qué-rep/fallo técnico, no hay reps "a fallo" acá.
export function FixedWindowPowerRow({
  sessionId,
  userId,
  exerciseId,
  templateSlotId,
  setNumber,
  windowSeconds,
  defaultLoad,
  existing,
}: {
  sessionId: string;
  userId: string;
  exerciseId: string;
  templateSlotId: string;
  setNumber: number;
  windowSeconds: number;
  defaultLoad: number | null;
  existing: LocalSetLog | undefined;
}) {
  const [editing, setEditing] = useState(!existing);
  const [load, setLoad] = useState(existing?.actual_load_kg ?? defaultLoad ?? 0);
  const [reps, setReps] = useState(existing?.actual_reps ?? 0);
  const [rpe, setRpe] = useState<number | null>(existing?.rpe_reported ?? null);

  const [remaining, setRemaining] = useState(windowSeconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function startWindow() {
    setReps(0);
    setRemaining(windowSeconds);
    firedRef.current = false;
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (!firedRef.current) {
            firedRef.current = true;
            if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(200);
          }
          if (intervalRef.current) clearInterval(intervalRef.current);
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
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
      actual_load_kg: load,
      target_reps: null,
      actual_reps: reps,
      actual_duration_seconds: null,
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
    return (
      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950">
        <span>
          Serie {setNumber}: {existing.actual_reps} reps × {existing.actual_load_kg}kg en {windowSeconds}s
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

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Serie {setNumber}</span>

      <label className="flex flex-col gap-1 text-sm">
        Carga (kg)
        <input
          aria-label="Carga en kg"
          inputMode="decimal"
          value={load}
          onChange={(e) => setLoad(Number(e.target.value) || 0)}
          className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="flex flex-col items-center gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        <span className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{remaining}s</span>
        <button
          type="button"
          onClick={startWindow}
          disabled={running}
          className="min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
        >
          {running ? "Ventana en curso…" : `Iniciar ventana de ${windowSeconds}s`}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Restar reps"
          onClick={() => setReps((q) => Math.max(0, q - 1))}
          className="h-11 w-11 rounded-lg border border-zinc-300 text-lg dark:border-zinc-700"
        >
          −
        </button>
        <input
          aria-label="Reps completadas"
          inputMode="numeric"
          value={reps}
          onChange={(e) => setReps(Number(e.target.value) || 0)}
          className="min-h-11 w-20 rounded-lg border border-zinc-300 px-3 py-2 text-center text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          aria-label="Sumar reps"
          onClick={() => setReps((q) => q + 1)}
          className="h-11 w-11 rounded-lg border border-zinc-300 text-lg dark:border-zinc-700"
        >
          +
        </button>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">reps completadas</span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">RPE percibido (esfuerzo)</span>
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
      </div>

      <button
        type="button"
        onClick={save}
        aria-label="Guardar serie"
        className="min-h-11 rounded-lg bg-emerald-600 px-4 py-3 text-center text-lg font-semibold text-white"
      >
        ✓
      </button>
    </div>
  );
}
