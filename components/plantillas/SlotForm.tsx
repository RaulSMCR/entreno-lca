"use client";

import { useState } from "react";
import type { Database } from "@/types/database";

type SlotRow = Database["public"]["Tables"]["template_slots"]["Row"];
type ExerciseOption = { id: string; name: string; block: string; unit: string; category: string | null };

export type SlotFormValues = {
  exercise_id: string;
  block: "principal" | "secundario";
  sets: number | null;
  reps: number | null;
  pct_max: number | null;
  rpe_target: number | null;
  reps_or_time: string | null;
  intensity_note: string | null;
  scheme_raw: string | null;
  target_duration_seconds: number | null;
};

function fromRow(row: SlotRow | null, exercises: ExerciseOption[]): SlotFormValues {
  if (!row) {
    return {
      exercise_id: exercises[0]?.id ?? "",
      block: "principal",
      sets: null,
      reps: null,
      pct_max: null,
      rpe_target: null,
      reps_or_time: null,
      intensity_note: null,
      scheme_raw: null,
      target_duration_seconds: null,
    };
  }
  return {
    exercise_id: row.exercise_id,
    block: row.block as SlotFormValues["block"],
    sets: row.sets,
    reps: row.reps,
    pct_max: row.pct_max,
    rpe_target: row.rpe_target,
    reps_or_time: row.reps_or_time,
    intensity_note: row.intensity_note,
    scheme_raw: row.scheme_raw,
    target_duration_seconds: row.target_duration_seconds,
  };
}

export function SlotForm({
  initial,
  exercises,
  onSave,
  onCancel,
}: {
  initial: SlotRow | null;
  exercises: ExerciseOption[];
  onSave: (values: SlotFormValues) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<SlotFormValues>(() => fromRow(initial, exercises));
  const [saving, setSaving] = useState(false);
  const selectedExercise = exercises.find((ex) => ex.id === values.exercise_id);
  const isCardio = selectedExercise?.category === "conditioning";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(values);
    setSaving(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <label className="flex flex-col gap-1 text-sm">
        Ejercicio
        <select
          required
          value={values.exercise_id}
          onChange={(e) => setValues((v) => ({ ...v, exercise_id: e.target.value }))}
          className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {exercises.length === 0 && <option value="">No hay ejercicios activos</option>}
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Bloque
        <select
          value={values.block}
          onChange={(e) => setValues((v) => ({ ...v, block: e.target.value as SlotFormValues["block"] }))}
          className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="principal">Principal</option>
          <option value="secundario">Secundario</option>
        </select>
      </label>

      {isCardio ? (
        <label className="flex flex-col gap-1 text-sm">
          Minutos objetivo
          <input
            inputMode="numeric"
            value={values.target_duration_seconds != null ? Math.round(values.target_duration_seconds / 60) : ""}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                target_duration_seconds: e.target.value === "" ? null : Number(e.target.value) * 60,
              }))
            }
            placeholder="16"
            className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      ) : values.block === "principal" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Series
            <input
              inputMode="numeric"
              value={values.sets ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, sets: e.target.value === "" ? null : Number(e.target.value) }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Reps
            <input
              inputMode="numeric"
              value={values.reps ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, reps: e.target.value === "" ? null : Number(e.target.value) }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            % máx
            <input
              inputMode="decimal"
              value={values.pct_max ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, pct_max: e.target.value === "" ? null : Number(e.target.value) }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            RPE objetivo
            <input
              inputMode="decimal"
              value={values.rpe_target ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, rpe_target: e.target.value === "" ? null : Number(e.target.value) }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Reps o tiempo
            <input
              value={values.reps_or_time ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, reps_or_time: e.target.value || null }))}
              placeholder="15 por lado, 45 segundos, Fallo técnico..."
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Intensidad
            <input
              value={values.intensity_note ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, intensity_note: e.target.value || null }))}
              placeholder="Moderado, Isométrico >30s..."
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            RPE objetivo (opcional)
            <input
              inputMode="decimal"
              value={values.rpe_target ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, rpe_target: e.target.value === "" ? null : Number(e.target.value) }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || !values.exercise_id}
          className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
