"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { calculateAge } from "@/lib/body-metrics";
import type { Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["user_profiles"]["Row"];

type ProfileFormValues = {
  full_name: string;
  birth_date: string;
  sex: "male" | "female" | "other" | "";
  height_cm: string;
  injury_context: string;
  surgery_date: string;
  rehab_phase: "early_rehab" | "late_rehab" | "return_to_sport" | "performance" | "";
  weight_tracking_frequency_days: number;
  inbody_tracking_frequency_days: number;
  rm_retest_frequency_days: number;
};

const REHAB_PHASE_OPTIONS: { value: ProfileFormValues["rehab_phase"]; label: string; description: string }[] = [
  { value: "early_rehab", label: "Rehabilitación temprana", description: "Post-quirúrgico inmediato, sin alta para ejercicio de pierna." },
  { value: "late_rehab", label: "Rehabilitación tardía", description: "Alta para tren superior y trabajo funcional, pierna aún en progreso." },
  { value: "return_to_sport", label: "Retorno al deporte", description: "Clearance para carga en pierna sana, preparando reintegro." },
  { value: "performance", label: "Rendimiento", description: "Fuera de fase de rehab activa, foco en el plan de rendimiento." },
];

function fromRow(row: ProfileRow | null): ProfileFormValues {
  if (!row) {
    return {
      full_name: "",
      birth_date: "",
      sex: "",
      height_cm: "",
      injury_context: "",
      surgery_date: "",
      rehab_phase: "",
      weight_tracking_frequency_days: 7,
      inbody_tracking_frequency_days: 56,
      rm_retest_frequency_days: 84,
    };
  }
  return {
    full_name: row.full_name ?? "",
    birth_date: row.birth_date ?? "",
    sex: (row.sex as ProfileFormValues["sex"]) ?? "",
    height_cm: row.height_cm != null ? String(row.height_cm) : "",
    injury_context: row.injury_context ?? "",
    surgery_date: row.surgery_date ?? "",
    rehab_phase: (row.rehab_phase as ProfileFormValues["rehab_phase"]) ?? "",
    weight_tracking_frequency_days: row.weight_tracking_frequency_days,
    inbody_tracking_frequency_days: row.inbody_tracking_frequency_days,
    rm_retest_frequency_days: row.rm_retest_frequency_days,
  };
}

export function PerfilClient({ userId, initialProfile }: { userId: string; initialProfile: ProfileRow | null }) {
  const [values, setValues] = useState<ProfileFormValues>(() => fromRow(initialProfile));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bannerOpen, setBannerOpen] = useState(false);

  const age = values.birth_date ? calculateAge(values.birth_date) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const supabase = createClient();
    const { error: saveError } = await supabase.from("user_profiles").upsert({
      id: userId,
      full_name: values.full_name || null,
      birth_date: values.birth_date || null,
      sex: values.sex || null,
      height_cm: values.height_cm === "" ? null : Number(values.height_cm),
      injury_context: values.injury_context || null,
      surgery_date: values.surgery_date || null,
      rehab_phase: values.rehab_phase || null,
      weight_tracking_frequency_days: values.weight_tracking_frequency_days,
      inbody_tracking_frequency_days: values.inbody_tracking_frequency_days,
      rm_retest_frequency_days: values.rm_retest_frequency_days,
    });

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setSaved(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Perfil</h1>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <Link href="/perfil/peso" className="rounded-lg border border-zinc-300 px-3 py-2 text-center font-medium dark:border-zinc-700">
          Peso
        </Link>
        <Link href="/perfil/inbody" className="rounded-lg border border-zinc-300 px-3 py-2 text-center font-medium dark:border-zinc-700">
          InBody
        </Link>
        <Link href="/perfil/fuerza" className="rounded-lg border border-zinc-300 px-3 py-2 text-center font-medium dark:border-zinc-700">
          Fuerza
        </Link>
      </div>
      <Link href="/calibracion" className="rounded-lg bg-accent-600 px-4 py-2 text-center text-sm font-semibold text-brand-950">
        Ir a calibración
      </Link>

      <details
        open={bannerOpen}
        onToggle={(e) => setBannerOpen((e.target as HTMLDetailsElement).open)}
        className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900 dark:bg-blue-950"
      >
        <summary className="cursor-pointer font-medium text-blue-900 dark:text-blue-100">
          Sobre el InBody: leer antes de registrar un scan
        </summary>
        <p className="mt-2 text-blue-900 dark:text-blue-100">
          El InBody tiende a subestimar el % de grasa corporal frente a DEXA (el estándar de referencia).
          Usalo como herramienta de <strong>tendencia</strong> (¿hacia dónde va tu composición corporal?),
          no como una medición absoluta puntual.
        </p>
      </details>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <label className="flex flex-col gap-1 text-sm">
          Nombre
          <input
            value={values.full_name}
            onChange={(e) => setValues((v) => ({ ...v, full_name: e.target.value }))}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Fecha de nacimiento {age != null && <span className="text-zinc-400">({age} años)</span>}
            <input
              type="date"
              value={values.birth_date}
              onChange={(e) => setValues((v) => ({ ...v, birth_date: e.target.value }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Sexo
            <select
              value={values.sex}
              onChange={(e) => setValues((v) => ({ ...v, sex: e.target.value as ProfileFormValues["sex"] }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Sin especificar</option>
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
              <option value="other">Otro</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Estatura (cm)
          <input
            inputMode="decimal"
            value={values.height_cm}
            onChange={(e) => setValues((v) => ({ ...v, height_cm: e.target.value }))}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Fase de rehabilitación
          <select
            value={values.rehab_phase}
            onChange={(e) => setValues((v) => ({ ...v, rehab_phase: e.target.value as ProfileFormValues["rehab_phase"] }))}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Sin especificar</option>
            {REHAB_PHASE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {values.rehab_phase && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {REHAB_PHASE_OPTIONS.find((o) => o.value === values.rehab_phase)?.description}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Nota de lesión
          <textarea
            value={values.injury_context}
            onChange={(e) => setValues((v) => ({ ...v, injury_context: e.target.value }))}
            rows={2}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Fecha de cirugía
          <input
            type="date"
            value={values.surgery_date}
            onChange={(e) => setValues((v) => ({ ...v, surgery_date: e.target.value }))}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">Cadencias de tracking</p>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1 text-sm">
              Peso
              <select
                value={values.weight_tracking_frequency_days}
                onChange={(e) => setValues((v) => ({ ...v, weight_tracking_frequency_days: Number(e.target.value) }))}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value={3}>3 días</option>
                <option value={7}>7 días</option>
                <option value={14}>14 días</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              InBody
              <select
                value={values.inbody_tracking_frequency_days}
                onChange={(e) => setValues((v) => ({ ...v, inbody_tracking_frequency_days: Number(e.target.value) }))}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value={28}>28 días</option>
                <option value={42}>42 días</option>
                <option value={56}>56 días</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              1RM
              <select
                value={values.rm_retest_frequency_days}
                onChange={(e) => setValues((v) => ({ ...v, rm_retest_frequency_days: Number(e.target.value) }))}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value={56}>56 días</option>
                <option value={84}>84 días</option>
                <option value={112}>112 días</option>
              </select>
            </label>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {saved && !error && <p className="text-sm text-emerald-600 dark:text-emerald-400">Perfil guardado.</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent-600 px-4 py-2 font-medium text-brand-950 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </form>
    </div>
  );
}
