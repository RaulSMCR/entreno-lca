"use client";

import { useState } from "react";
import { db, newId, nowIso, type LocalSetLog } from "@/lib/db";

// distancia_carga (hoy solo "Suitcase Carry"): metros recorridos + carga
// manual (no hay un valor fijo real en los datos para prellenar desde el
// equipment) + chequeo de postura. Sin RPE — lo que importa acá es completar
// la distancia con la postura sostenida, no el esfuerzo percibido.
export function DistanceLoadRow({
  sessionId,
  userId,
  exerciseId,
  templateSlotId,
  setNumber,
  existing,
}: {
  sessionId: string;
  userId: string;
  exerciseId: string;
  templateSlotId: string;
  setNumber: number;
  existing: LocalSetLog | undefined;
}) {
  const [editing, setEditing] = useState(!existing);
  const [meters, setMeters] = useState(existing?.actual_reps ?? 0);
  const [load, setLoad] = useState(existing?.actual_load_kg ?? 0);
  const [postureOk, setPostureOk] = useState(existing?.posture_ok ?? true);

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
      actual_reps: meters,
      actual_duration_seconds: null,
      rpe_reported: null,
      rpe_at_rep: null,
      is_failure: false,
      note: null,
      side: null,
      rom_rpe: null,
      posture_ok: postureOk,
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
          Serie {setNumber}: {existing.actual_reps}m × {existing.actual_load_kg}kg
          {existing.posture_ok === false ? " · postura no sostenida" : ""}
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

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Restar metros"
          onClick={() => setMeters((m) => Math.max(0, m - 1))}
          className="h-11 w-11 rounded-lg border border-zinc-300 text-lg dark:border-zinc-700"
        >
          −
        </button>
        <input
          aria-label="Metros"
          inputMode="numeric"
          value={meters}
          onChange={(e) => setMeters(Number(e.target.value) || 0)}
          className="min-h-11 w-20 rounded-lg border border-zinc-300 px-3 py-2 text-center text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          aria-label="Sumar metros"
          onClick={() => setMeters((m) => m + 1)}
          className="h-11 w-11 rounded-lg border border-zinc-300 text-lg dark:border-zinc-700"
        >
          +
        </button>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">metros</span>
      </div>

      <label className="flex min-h-11 items-center gap-1.5 py-2 text-sm">
        <input
          type="checkbox"
          checked={postureOk}
          onChange={(e) => setPostureOk(e.target.checked)}
          className="h-5 w-5"
        />
        Postura mantenida
      </label>

      <button
        type="button"
        onClick={save}
        aria-label="Guardar serie"
        className="min-h-11 rounded-lg bg-accent-600 px-4 py-3 text-center text-lg font-semibold text-brand-950"
      >
        ✓
      </button>
    </div>
  );
}
