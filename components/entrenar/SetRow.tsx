"use client";

import { useEffect, useRef, useState } from "react";
import { db, newId, nowIso, type LocalSetLog } from "@/lib/db";
import type { LoggingFieldConfig } from "@/lib/exerciseLogging";
import type { VoicePrefill } from "./SlotCard";

const RPE_STEPS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const ROM_RPE_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SIDE_OPTIONS: { value: "left" | "right" | "both"; label: string }[] = [
  { value: "left", label: "Izquierda" },
  { value: "right", label: "Derecha" },
  { value: "both", label: "Ambos" },
];

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
  templateSlotId,
  setNumber,
  unit,
  schema,
  loadOptions,
  defaults,
  existing,
  targetLabel,
  voicePrefill,
}: {
  sessionId: string;
  userId: string;
  exerciseId: string;
  /** template_slots.id — identifica el slot dentro de la plantilla, ya que
   *  exerciseId no es único por sesión (un ejercicio puede repetirse en más
   *  de un slot). */
  templateSlotId: string;
  setNumber: number;
  /** Solo se usa para el label cosmético de la cantidad (ej. "metros") — el
   *  comportamiento del formulario lo decide `schema`, no `unit`. */
  unit: "kg" | "seconds" | "meters" | "intervals" | "reps";
  /** exercises.purpose vía getLoggingSchema() — decide qué campos mostrar. */
  schema: LoggingFieldConfig;
  loadOptions: number[];
  defaults: { load: number | null; reps: number | null; rpe: number | null };
  existing: LocalSetLog | undefined;
  targetLabel: string | null;
  voicePrefill?: VoicePrefill;
}) {
  const [editing, setEditing] = useState(!existing || !!voicePrefill);
  const [load, setLoad] = useState(
    voicePrefill?.load ?? existing?.actual_load_kg ?? defaults.load ?? loadOptions[0] ?? 0
  );
  const [qty, setQty] = useState(voicePrefill?.reps ?? existing?.actual_reps ?? defaults.reps ?? 0);
  const [rpe, setRpe] = useState<number | null>(voicePrefill?.rpe ?? existing?.rpe_reported ?? defaults.rpe ?? null);
  const [rpeAtRep, setRpeAtRep] = useState<number | null>(existing?.rpe_at_rep ?? null);
  const [isFailure, setIsFailure] = useState(existing?.is_failure ?? false);
  const [note, setNote] = useState(existing?.note ?? "");
  const [side, setSide] = useState<"left" | "right" | "both" | null>(
    (existing?.side as "left" | "right" | "both" | null) ?? null
  );
  const [romRpe, setRomRpe] = useState<number | null>(existing?.rom_rpe ?? null);

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
      template_slot_id: templateSlotId,
      set_number: setNumber,
      target_load_kg: existing?.target_load_kg ?? null,
      actual_load_kg: schema.showLoad ? load : null,
      target_reps: existing?.target_reps ?? null,
      actual_reps: qty,
      actual_duration_seconds: null,
      rpe_reported: schema.showRpe ? rpe : null,
      rpe_at_rep: schema.showRpeAtRep ? rpeAtRep : null,
      is_failure: schema.showFailureCheckbox ? isFailure : false,
      note: schema.showNotes && note.trim() !== "" ? note.trim() : null,
      side: schema.showSide ? side : null,
      rom_rpe: schema.showRomRpe ? romRpe : null,
      posture_ok: null,
      synced_from_local: true,
      _dirty: 1,
      _deleted: 0,
    };
    await db.set_logs.put(row);
    setEditing(false);
  }

  const qtyLabel = schema.showStopwatch ? "segundos" : UNIT_LABEL[unit] ?? "reps";

  if (!editing && existing) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950">
        <span>
          Serie {setNumber}: {schema.showLoad ? `${existing.actual_load_kg}kg × ` : ""}
          {existing.actual_reps}
          {!schema.showLoad ? ` ${qtyLabel}` : ""}
          {existing.side ? ` · ${SIDE_OPTIONS.find((s) => s.value === existing.side)?.label ?? existing.side}` : ""}
          {existing.rpe_reported != null ? ` · RPE ${existing.rpe_reported}` : ""}
          {existing.rom_rpe != null ? ` · ROM ${existing.rom_rpe}` : ""}
          {existing.is_failure ? " · fallo técnico" : ""}
          {schema.showNotes && existing.note ? ` · "${existing.note}"` : ""}
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
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-900 dark:text-zinc-50">Serie {setNumber}</span>
        {targetLabel && <span className="text-zinc-500 dark:text-zinc-400">{targetLabel}</span>}
      </div>

      {schema.showLoad &&
        (loadOptions.length > 0 ? (
          <select
            aria-label="Carga en kg"
            value={load}
            onChange={(e) => setLoad(Number(e.target.value))}
            className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          >
            {loadOptions.map((l) => (
              <option key={l} value={l}>
                {l} kg
              </option>
            ))}
          </select>
        ) : (
          <input
            aria-label="Carga en kg"
            inputMode="decimal"
            value={load}
            onChange={(e) => setLoad(Number(e.target.value) || 0)}
            placeholder="Carga (kg)"
            className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        ))}

      {schema.showSide && (
        <div className="flex gap-1.5" role="group" aria-label="Lado">
          {SIDE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={side === opt.value ? "true" : "false"}
              onClick={() => setSide(opt.value)}
              className={`min-h-11 flex-1 rounded-lg border px-3 py-2 text-sm ${
                side === opt.value
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {(schema.showReps || schema.showStopwatch) && (
        <div className="flex items-center gap-2">
          {schema.showStopwatch && (
            <button
              type="button"
              onClick={toggleStopwatch}
              className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
            >
              {running ? "Detener" : "Iniciar"} cronómetro
            </button>
          )}
          <button
            type="button"
            aria-label={`Restar ${qtyLabel}`}
            onClick={() => setQty((q) => Math.max(0, q - 1))}
            className="h-11 w-11 rounded-lg border border-zinc-300 text-lg dark:border-zinc-700"
          >
            −
          </button>
          <input
            aria-label={qtyLabel}
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value) || 0)}
            className="min-h-11 w-20 rounded-lg border border-zinc-300 px-3 py-2 text-center text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="button"
            aria-label={`Sumar ${qtyLabel}`}
            onClick={() => setQty((q) => q + 1)}
            className="h-11 w-11 rounded-lg border border-zinc-300 text-lg dark:border-zinc-700"
          >
            +
          </button>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{qtyLabel}</span>
        </div>
      )}

      {schema.showRpe && (
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
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {schema.showRomRpe && (
        <div className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Restricción de ROM</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Restricción de ROM">
            {ROM_RPE_STEPS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={romRpe === r ? "true" : "false"}
                aria-label={`ROM ${r}`}
                onClick={() => setRomRpe(r)}
                className={`min-h-11 min-w-11 rounded-lg border px-3 py-2 text-sm ${
                  romRpe === r
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {(schema.showRpeAtRep || schema.showFailureCheckbox) && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          {schema.showRpeAtRep && (
            <label className="flex min-h-11 items-center gap-1 py-2">
              ¿A qué rep sentiste el RPE?
              <input
                inputMode="numeric"
                value={rpeAtRep ?? ""}
                onChange={(e) => setRpeAtRep(e.target.value === "" ? null : Number(e.target.value))}
                className="min-h-11 w-14 rounded-lg border border-zinc-300 px-2 py-1 text-center dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
          )}
          {schema.showFailureCheckbox && (
            <label className="flex min-h-11 items-center gap-1.5 py-2">
              <input
                type="checkbox"
                checked={isFailure}
                onChange={(e) => setIsFailure(e.target.checked)}
                className="h-5 w-5"
              />
              Fallo técnico
            </label>
          )}
        </div>
      )}

      {schema.showNotes && (
        <label className="flex flex-col gap-1 text-sm">
          Observaciones
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Rango, molestia, lado más limitado..."
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      )}

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
