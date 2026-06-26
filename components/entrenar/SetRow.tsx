"use client";

import { useEffect, useRef, useState } from "react";
import { db, newId, nowIso, type LocalSetLog } from "@/lib/db";

const RPE_STEPS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

const UNIT_LABEL: Record<string, string> = {
  seconds: "segundos",
  meters: "metros",
  intervals: "intervalos",
  reps: "reps",
};

export function SetRow({
  sessionId,
  userId,
  exerciseId,
  setNumber,
  unit,
  loadOptions,
  defaults,
  existing,
  targetLabel,
}: {
  sessionId: string;
  userId: string;
  exerciseId: string;
  setNumber: number;
  unit: "kg" | "seconds" | "meters" | "intervals" | "reps";
  loadOptions: number[];
  defaults: { load: number | null; reps: number | null; rpe: number | null };
  existing: LocalSetLog | undefined;
  targetLabel: string | null;
}) {
  const [editing, setEditing] = useState(!existing);
  const [load, setLoad] = useState(existing?.actual_load_kg ?? defaults.load ?? loadOptions[0] ?? 0);
  const [qty, setQty] = useState(existing?.actual_reps ?? defaults.reps ?? 0);
  const [rpe, setRpe] = useState<number | null>(existing?.rpe_reported ?? defaults.rpe ?? null);
  const [rpeAtRep, setRpeAtRep] = useState<number | null>(existing?.rpe_at_rep ?? null);
  const [isFailure, setIsFailure] = useState(existing?.is_failure ?? false);

  const [running, setRunning] = useState(false);
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
    } else {
      setQty(0);
      const start = Date.now();
      intervalRef.current = setInterval(() => {
        setQty(Math.round((Date.now() - start) / 1000));
      }, 250);
      setRunning(true);
    }
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
      set_number: setNumber,
      target_load_kg: existing?.target_load_kg ?? null,
      actual_load_kg: unit === "kg" ? load : null,
      target_reps: existing?.target_reps ?? null,
      actual_reps: unit === "kg" ? qty : qty,
      rpe_reported: rpe,
      rpe_at_rep: rpeAtRep,
      is_failure: isFailure,
      note: null,
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
          Serie {setNumber}: {unit === "kg" ? `${existing.actual_load_kg}kg × ` : ""}
          {existing.actual_reps}
          {unit !== "kg" ? ` ${UNIT_LABEL[unit] ?? ""}` : ""}
          {existing.rpe_reported != null ? ` · RPE ${existing.rpe_reported}` : ""}
          {existing.is_failure ? " · fallo técnico" : ""}
        </span>
        <button onClick={() => setEditing(true)} className="text-zinc-500 dark:text-zinc-400">
          Editar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-900 dark:text-zinc-50">Serie {setNumber}</span>
        {targetLabel && <span className="text-zinc-500 dark:text-zinc-400">{targetLabel}</span>}
      </div>

      {unit === "kg" &&
        (loadOptions.length > 0 ? (
          <select
            value={load}
            onChange={(e) => setLoad(Number(e.target.value))}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          >
            {loadOptions.map((l) => (
              <option key={l} value={l}>
                {l} kg
              </option>
            ))}
          </select>
        ) : (
          <input
            inputMode="decimal"
            value={load}
            onChange={(e) => setLoad(Number(e.target.value) || 0)}
            placeholder="Carga (kg)"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        ))}

      <div className="flex items-center gap-2">
        {unit === "seconds" && (
          <button
            type="button"
            onClick={toggleStopwatch}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          >
            {running ? "Detener" : "Iniciar"} cronómetro
          </button>
        )}
        <button
          type="button"
          onClick={() => setQty((q) => Math.max(0, q - 1))}
          className="h-10 w-10 rounded-lg border border-zinc-300 text-lg dark:border-zinc-700"
        >
          −
        </button>
        <input
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value) || 0)}
          className="w-20 rounded-lg border border-zinc-300 px-3 py-2 text-center text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={() => setQty((q) => q + 1)}
          className="h-10 w-10 rounded-lg border border-zinc-300 text-lg dark:border-zinc-700"
        >
          +
        </button>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">{unit !== "kg" ? UNIT_LABEL[unit] : "reps"}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {RPE_STEPS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRpe(r)}
            className={`rounded-lg border px-3 py-2 text-sm ${
              rpe === r
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
        <label className="flex items-center gap-1">
          ¿A qué rep sentiste el RPE?
          <input
            inputMode="numeric"
            value={rpeAtRep ?? ""}
            onChange={(e) => setRpeAtRep(e.target.value === "" ? null : Number(e.target.value))}
            className="w-14 rounded-lg border border-zinc-300 px-2 py-1 text-center dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={isFailure} onChange={(e) => setIsFailure(e.target.checked)} />
          Fallo técnico
        </label>
      </div>

      <button
        onClick={save}
        className="rounded-lg bg-emerald-600 px-4 py-3 text-center text-lg font-semibold text-white"
      >
        ✓
      </button>
    </div>
  );
}
