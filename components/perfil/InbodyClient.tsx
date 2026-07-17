"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { markTrackingDone } from "@/lib/tracking-cadence";
import { calculateBMI, calculateLSI, getLSIInterpretation } from "@/lib/body-metrics";
import type { Database } from "@/types/database";

type ScanRow = Database["public"]["Tables"]["inbody_scans"]["Row"];

type FormState = Record<
  | "scanned_at"
  | "weight_kg"
  | "body_fat_pct"
  | "muscle_mass_kg"
  | "fat_mass_kg"
  | "total_body_water_l"
  | "intracellular_water_l"
  | "extracellular_water_l"
  | "protein_kg"
  | "minerals_kg"
  | "muscle_right_arm_kg"
  | "muscle_left_arm_kg"
  | "muscle_trunk_kg"
  | "muscle_right_leg_kg"
  | "muscle_left_leg_kg"
  | "visceral_fat_level"
  | "note",
  string
>;

const EMPTY_FORM: FormState = {
  scanned_at: new Date().toISOString().slice(0, 10),
  weight_kg: "",
  body_fat_pct: "",
  muscle_mass_kg: "",
  fat_mass_kg: "",
  total_body_water_l: "",
  intracellular_water_l: "",
  extracellular_water_l: "",
  protein_kg: "",
  minerals_kg: "",
  muscle_right_arm_kg: "",
  muscle_left_arm_kg: "",
  muscle_trunk_kg: "",
  muscle_right_leg_kg: "",
  muscle_left_leg_kg: "",
  visceral_fat_level: "",
  note: "",
};

function toNumberOrNull(s: string): number | null {
  return s === "" ? null : Number(s);
}

function numberField(
  label: string,
  key: keyof FormState,
  form: FormState,
  setForm: React.Dispatch<React.SetStateAction<FormState>>
) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        inputMode="decimal"
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
      />
    </label>
  );
}

export function InbodyClient({
  userId,
  initialScans,
  heightCm,
}: {
  userId: string;
  initialScans: ScanRow[];
  heightCm: number | null;
}) {
  const [scans, setScans] = useState(initialScans);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showWater, setShowWater] = useState(false);
  const [showSegments, setShowSegments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rightLeg = toNumberOrNull(form.muscle_right_leg_kg);
  const leftLeg = toNumberOrNull(form.muscle_left_leg_kg);
  const lsi = rightLeg != null && leftLeg != null && rightLeg > 0 && leftLeg > 0
    ? calculateLSI(Math.min(rightLeg, leftLeg), Math.max(rightLeg, leftLeg))
    : null;
  const lsiInterpretation = lsi != null ? getLSIInterpretation(lsi) : null;

  const weightKg = toNumberOrNull(form.weight_kg);
  const bmi = weightKg != null && heightCm != null ? calculateBMI(weightKg, heightCm) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.scanned_at) {
      setError("La fecha es obligatoria.");
      return;
    }
    const hasMainField = [form.weight_kg, form.body_fat_pct, form.muscle_mass_kg, form.fat_mass_kg].some((v) => v !== "");
    if (!hasMainField) {
      setError("Completá al menos un dato principal (peso, % grasa, masa muscular o masa grasa).");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data, error: saveError } = await supabase
      .from("inbody_scans")
      .insert({
        user_id: userId,
        scanned_at: new Date(form.scanned_at).toISOString(),
        weight_kg: toNumberOrNull(form.weight_kg),
        body_fat_pct: toNumberOrNull(form.body_fat_pct),
        muscle_mass_kg: toNumberOrNull(form.muscle_mass_kg),
        fat_mass_kg: toNumberOrNull(form.fat_mass_kg),
        total_body_water_l: toNumberOrNull(form.total_body_water_l),
        intracellular_water_l: toNumberOrNull(form.intracellular_water_l),
        extracellular_water_l: toNumberOrNull(form.extracellular_water_l),
        protein_kg: toNumberOrNull(form.protein_kg),
        minerals_kg: toNumberOrNull(form.minerals_kg),
        muscle_right_arm_kg: toNumberOrNull(form.muscle_right_arm_kg),
        muscle_left_arm_kg: toNumberOrNull(form.muscle_left_arm_kg),
        muscle_trunk_kg: toNumberOrNull(form.muscle_trunk_kg),
        muscle_right_leg_kg: rightLeg,
        muscle_left_leg_kg: leftLeg,
        bmi,
        visceral_fat_level: form.visceral_fat_level === "" ? null : Math.round(Number(form.visceral_fat_level)),
        lsi_lower_limb_pct: lsi,
        note: form.note || null,
      })
      .select()
      .single();

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }

    await markTrackingDone(userId, "inbody_scan");
    setScans((prev) => [data, ...prev]);
    setForm(EMPTY_FORM);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Scan InBody</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Principal</p>
        <label className="flex flex-col gap-1 text-sm">
          Fecha
          <input
            type="date"
            value={form.scanned_at}
            onChange={(e) => setForm((f) => ({ ...f, scanned_at: e.target.value }))}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          {numberField("Peso (kg)", "weight_kg", form, setForm)}
          {numberField("% Grasa", "body_fat_pct", form, setForm)}
          {numberField("Masa muscular (SMM, kg)", "muscle_mass_kg", form, setForm)}
          {numberField("Masa grasa (kg)", "fat_mass_kg", form, setForm)}
        </div>

        <details open={showWater} onToggle={(e) => setShowWater((e.target as HTMLDetailsElement).open)}>
          <summary className="cursor-pointer text-sm font-medium text-zinc-900 dark:text-zinc-50">Agua corporal (opcional)</summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {numberField("Agua corporal total (L)", "total_body_water_l", form, setForm)}
            {numberField("Agua intracelular (L)", "intracellular_water_l", form, setForm)}
            {numberField("Agua extracelular (L)", "extracellular_water_l", form, setForm)}
            {numberField("Proteína (kg)", "protein_kg", form, setForm)}
            {numberField("Minerales (kg)", "minerals_kg", form, setForm)}
          </div>
        </details>

        <details open={showSegments} onToggle={(e) => setShowSegments((e.target as HTMLDetailsElement).open)}>
          <summary className="cursor-pointer text-sm font-medium text-zinc-900 dark:text-zinc-50">Segmentos musculares (opcional)</summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {numberField("Brazo derecho (kg)", "muscle_right_arm_kg", form, setForm)}
            {numberField("Brazo izquierdo (kg)", "muscle_left_arm_kg", form, setForm)}
            {numberField("Tronco (kg)", "muscle_trunk_kg", form, setForm)}
            {numberField("Pierna derecha (kg)", "muscle_right_leg_kg", form, setForm)}
            {numberField("Pierna izquierda (kg)", "muscle_left_leg_kg", form, setForm)}
          </div>
          {lsi != null && lsiInterpretation && (
            <div className="mt-2 rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">LSI piernas: {lsi.toFixed(1)}%</p>
              <p className="text-zinc-600 dark:text-zinc-300">{lsiInterpretation.message}</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(100, (lsi / 90) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </details>

        <div>
          <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">Índices</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 text-sm">
              <span>IMC (calculado)</span>
              <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-base dark:border-zinc-800 dark:bg-zinc-900">
                {bmi != null ? bmi.toFixed(1) : heightCm == null ? "Sin estatura en perfil" : "—"}
              </span>
            </div>
            {numberField("Grasa visceral (nivel)", "visceral_fat_level", form, setForm)}
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Nota
          <input
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-lg bg-accent-600 px-4 py-2 font-medium text-brand-950 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar scan"}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <p className="font-medium text-zinc-900 dark:text-zinc-50">Historial</p>
        {scans.length === 0 && <p className="text-sm text-zinc-400">Sin scans registrados todavía.</p>}
        {scans.map((scan, i) => {
          const prevScan = scans[i + 1] ?? null;
          const weightDelta = scan.weight_kg != null && prevScan?.weight_kg != null ? scan.weight_kg - prevScan.weight_kg : null;
          const fatDelta = scan.body_fat_pct != null && prevScan?.body_fat_pct != null ? scan.body_fat_pct - prevScan.body_fat_pct : null;
          const muscleDelta =
            scan.muscle_mass_kg != null && prevScan?.muscle_mass_kg != null ? scan.muscle_mass_kg - prevScan.muscle_mass_kg : null;
          return (
            <div key={scan.id} className="rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                {new Date(scan.scanned_at).toLocaleDateString()}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                Peso {scan.weight_kg ?? "—"}kg{weightDelta != null && ` (${weightDelta >= 0 ? "+" : ""}${weightDelta.toFixed(1)})`} ·
                {" "}% grasa {scan.body_fat_pct ?? "—"}{fatDelta != null && ` (${fatDelta >= 0 ? "+" : ""}${fatDelta.toFixed(1)})`} ·{" "}
                Músculo {scan.muscle_mass_kg ?? "—"}kg{muscleDelta != null && ` (${muscleDelta >= 0 ? "+" : ""}${muscleDelta.toFixed(1)})`}
              </p>
              {scan.lsi_lower_limb_pct != null && (
                <p className="text-zinc-500 dark:text-zinc-400">LSI piernas: {scan.lsi_lower_limb_pct.toFixed(1)}%</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
