"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { markTrackingDone } from "@/lib/tracking-cadence";
import { getRollingAverageWeight, getWeightTrend } from "@/lib/body-metrics";
import { WeightChart } from "./WeightChart";
import type { Database } from "@/types/database";

type WeightLogRow = Database["public"]["Tables"]["body_weight_logs"]["Row"];

export function PesoClient({ userId, initialLogs }: { userId: string; initialLogs: WeightLogRow[] }) {
  const [logs, setLogs] = useState(initialLogs);
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...logs].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  const current = sorted.length > 0 ? sorted[sorted.length - 1].weight_kg : null;
  const rollingAverage = getRollingAverageWeight(sorted, 7);
  const trend = getWeightTrend(sorted);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const weightKg = Number(weight);
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      setError("Ingresá un peso válido.");
      return;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: saveError } = await supabase
      .from("body_weight_logs")
      .insert({ user_id: userId, weight_kg: weightKg, note: note || null })
      .select()
      .single();

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }

    await markTrackingDone(userId, "body_weight");
    setLogs((prev) => [...prev, data]);
    setWeight("");
    setNote("");
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Registro de peso</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Peso (kg)</span>
          <input
            inputMode="decimal"
            autoFocus
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="0.0"
            className="rounded-lg border border-zinc-300 px-4 py-3 text-3xl font-semibold tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nota (opcional)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {saving ? "Guardando…" : "Registrar"}
        </button>
      </form>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-zinc-500 dark:text-zinc-400">Peso actual</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{current != null ? `${current.toFixed(1)} kg` : "—"}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-zinc-500 dark:text-zinc-400">Promedio 7 días</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {rollingAverage != null ? `${rollingAverage.toFixed(1)} kg` : "Faltan registros"}
          </p>
        </div>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-300">{trend.message}</p>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">Últimas 8 semanas</p>
        <WeightChart data={sorted} />
      </div>
    </div>
  );
}
