"use client";

import { useState } from "react";
import type { Database } from "@/types/database";

type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];

export type ExerciseFormValues = {
  name: string;
  block: "principal" | "secundario";
  category: string | null;
  unit: "kg" | "seconds" | "meters" | "intervals" | "reps";
  equipment_id: string | null;
  e1rm_kg: number | null;
  biomech_note: string | null;
};

function fromRow(row: ExerciseRow | null): ExerciseFormValues {
  if (!row) {
    return {
      name: "",
      block: "principal",
      category: null,
      unit: "kg",
      equipment_id: null,
      e1rm_kg: null,
      biomech_note: null,
    };
  }
  return {
    name: row.name,
    block: row.block as ExerciseFormValues["block"],
    category: row.category,
    unit: row.unit as ExerciseFormValues["unit"],
    equipment_id: row.equipment_id,
    e1rm_kg: row.e1rm_kg,
    biomech_note: row.biomech_note,
  };
}

export function ExerciseForm({
  initial,
  equipment,
  onSave,
  onCancel,
}: {
  initial: ExerciseRow | null;
  equipment: { id: string; name: string }[];
  onSave: (values: ExerciseFormValues) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ExerciseFormValues>(() => fromRow(initial));
  const [saving, setSaving] = useState(false);

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
        Nombre
        <input
          required
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Bloque
          <select
            value={values.block}
            onChange={(e) => setValues((v) => ({ ...v, block: e.target.value as ExerciseFormValues["block"] }))}
            className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="principal">Principal</option>
            <option value="secundario">Secundario</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Unidad
          <select
            value={values.unit}
            onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value as ExerciseFormValues["unit"] }))}
            className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="kg">Carga (kg)</option>
            <option value="seconds">Segundos</option>
            <option value="meters">Metros</option>
            <option value="intervals">Intervalos</option>
            <option value="reps">Repeticiones</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Categoría
        <input
          value={values.category ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, category: e.target.value || null }))}
          placeholder="pull, push, core, grip, conditioning..."
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Equipo asociado
        <select
          value={values.equipment_id ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, equipment_id: e.target.value || null }))}
          className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Ninguno</option>
          {equipment.map((eq) => (
            <option key={eq.id} value={eq.id}>
              {eq.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        e1RM actual (kg){values.unit !== "kg" && " — no aplica a esta unidad"}
        <input
          inputMode="decimal"
          value={values.e1rm_kg ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, e1rm_kg: e.target.value === "" ? null : Number(e.target.value) }))}
          className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Nota biomecánica
        <textarea
          value={values.biomech_note ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, biomech_note: e.target.value || null }))}
          rows={2}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
