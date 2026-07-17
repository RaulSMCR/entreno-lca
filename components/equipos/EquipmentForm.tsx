"use client";

import { useState } from "react";
import { resolveAvailableLoads } from "@/lib/loads";
import type { Database } from "@/types/database";

type EquipmentRow = Database["public"]["Tables"]["equipment"]["Row"];

export type EquipmentFormValues = {
  name: string;
  type: "free_weight" | "machine" | "cable_stack" | "bodyweight" | "barbell";
  load_mode: "list" | "range" | "barbell";
  available_loads: number[] | null;
  min_kg: number | null;
  max_kg: number | null;
  step_kg: number | null;
  bar_kg: number | null;
  plate_pairs: number[] | null;
  micro_plates: number[] | null;
};

function parseNumberList(text: string): number[] {
  return Array.from(
    new Set(
      text
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter((n) => Number.isFinite(n))
    )
  ).sort((a, b) => a - b);
}

function generateSeries(min: number, max: number, step: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || step <= 0 || max < min) return [];
  const out: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

function fromRow(row: EquipmentRow | null): EquipmentFormValues {
  if (!row) {
    return {
      name: "",
      type: "free_weight",
      load_mode: "list",
      available_loads: [],
      min_kg: null,
      max_kg: null,
      step_kg: null,
      bar_kg: null,
      plate_pairs: [],
      micro_plates: [],
    };
  }
  return {
    name: row.name,
    type: row.type as EquipmentFormValues["type"],
    load_mode: row.load_mode as EquipmentFormValues["load_mode"],
    available_loads: row.available_loads,
    min_kg: row.min_kg,
    max_kg: row.max_kg,
    step_kg: row.step_kg,
    bar_kg: row.bar_kg,
    plate_pairs: row.plate_pairs,
    micro_plates: row.micro_plates,
  };
}

export function EquipmentForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: EquipmentRow | null;
  onSave: (values: EquipmentFormValues) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<EquipmentFormValues>(() => fromRow(initial));
  const [genMin, setGenMin] = useState("");
  const [genMax, setGenMax] = useState("");
  const [genStep, setGenStep] = useState("");
  const [saving, setSaving] = useState(false);

  const preview = resolveAvailableLoads(values);

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

      <label className="flex flex-col gap-1 text-sm">
        Tipo
        <select
          value={values.type}
          onChange={(e) => setValues((v) => ({ ...v, type: e.target.value as EquipmentFormValues["type"] }))}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="free_weight">Peso libre</option>
          <option value="machine">Máquina</option>
          <option value="cable_stack">Polea</option>
          <option value="bodyweight">Peso corporal</option>
          <option value="barbell">Barra</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Modo de carga
        <select
          value={values.load_mode}
          onChange={(e) =>
            setValues((v) => ({ ...v, load_mode: e.target.value as EquipmentFormValues["load_mode"] }))
          }
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="list">Lista de pesos</option>
          <option value="range">Rango continuo</option>
          <option value="barbell">Barra + discos</option>
        </select>
      </label>

      {values.load_mode === "list" && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Pesos disponibles (kg, separados por coma)
            <input
              value={(values.available_loads ?? []).join(", ")}
              onChange={(e) => setValues((v) => ({ ...v, available_loads: parseNumberList(e.target.value) }))}
              placeholder="2, 4, 6, 8, 10..."
              className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          <div className="flex items-end gap-2 text-sm">
            <label className="flex flex-col gap-1">
              Desde
              <input
                inputMode="decimal"
                value={genMin}
                onChange={(e) => setGenMin(e.target.value)}
                className="w-20 rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1">
              Hasta
              <input
                inputMode="decimal"
                value={genMax}
                onChange={(e) => setGenMax(e.target.value)}
                className="w-20 rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1">
              Paso
              <input
                inputMode="decimal"
                value={genStep}
                onChange={(e) => setGenStep(e.target.value)}
                className="w-20 rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <button
              type="button"
              onClick={() =>
                setValues((v) => ({
                  ...v,
                  available_loads: Array.from(
                    new Set([...(v.available_loads ?? []), ...generateSeries(Number(genMin), Number(genMax), Number(genStep))])
                  ).sort((a, b) => a - b),
                }))
              }
              className="rounded-lg border border-zinc-300 px-3 py-1.5 dark:border-zinc-700"
            >
              Generar serie
            </button>
          </div>
        </div>
      )}

      {values.load_mode === "range" && (
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Mín. (kg)
            <input
              inputMode="decimal"
              value={values.min_kg ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, min_kg: e.target.value === "" ? null : Number(e.target.value) }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Máx. (kg)
            <input
              inputMode="decimal"
              value={values.max_kg ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, max_kg: e.target.value === "" ? null : Number(e.target.value) }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Paso (kg)
            <input
              inputMode="decimal"
              value={values.step_kg ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, step_kg: e.target.value === "" ? null : Number(e.target.value) }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>
      )}

      {values.load_mode === "barbell" && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Peso de la barra (kg)
            <input
              inputMode="decimal"
              value={values.bar_kg ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, bar_kg: e.target.value === "" ? null : Number(e.target.value) }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Pares de discos disponibles (kg por disco, separados por coma)
            <input
              value={(values.plate_pairs ?? []).join(", ")}
              onChange={(e) => setValues((v) => ({ ...v, plate_pairs: parseNumberList(e.target.value) }))}
              placeholder="1.25, 2.5, 5, 10, 20"
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Microplacas (opcional)
            <input
              value={(values.micro_plates ?? []).join(", ")}
              onChange={(e) => setValues((v) => ({ ...v, micro_plates: parseNumberList(e.target.value) }))}
              placeholder="0.5, 1.25"
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>
      )}

      <div className="rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
        Cargas resultantes ({preview.length}): {preview.length > 0 ? preview.join(", ") : "—"}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent-600 px-4 py-2 font-medium text-brand-950 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
