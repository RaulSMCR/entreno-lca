"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { pullRemote } from "@/lib/sync";
import { getLSIInterpretation } from "@/lib/body-metrics";
import { evaluateStrengthLevel, getStrengthStandard, STRENGTH_STANDARDS_DISCLAIMER, type StrengthLevel } from "@/lib/strength-standards";

const LEVEL_BADGE_COLOR: Record<StrengthLevel, string> = {
  below_principiante: "bg-neutral-600 text-white",
  principiante: "bg-brand-200 text-brand-950",
  intermedio: "bg-brand-600 text-white",
  avanzado: "bg-accent-900 text-white",
  elite: "bg-accent-600 text-brand-950",
};

const LEVEL_BAR_COLOR: Record<StrengthLevel, string> = {
  below_principiante: "bg-neutral-600",
  principiante: "bg-brand-300",
  intermedio: "bg-brand-500",
  avanzado: "bg-accent-800",
  elite: "bg-accent-600",
};

const LEVEL_LABEL: Record<StrengthLevel, string> = {
  below_principiante: "Sin nivel",
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
  elite: "Elite",
};

const NRM_SOURCES = new Set(["five_rm_test", "ten_rm_test", "twelve_rm_test", "fifteen_rm_test", "epley_rpe"]);

export function FuerzaClient({ userId }: { userId: string }) {
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      pullRemote().catch(() => {});
    }
  }, []);

  const exercises = useLiveQuery(() => db.exercises.toCollection().filter((e) => e._deleted !== 1).toArray(), [], []);
  const estimates = useLiveQuery(() => db.e1rm_estimates.toCollection().filter((e) => e._deleted !== 1).toArray(), [], []);
  const weightLogs = useLiveQuery(() => db.body_weight_logs.orderBy("logged_at").toArray(), [], []);
  const scans = useLiveQuery(() => db.inbody_scans.orderBy("scanned_at").reverse().toArray(), [], []);
  const profile = useLiveQuery(() => db.user_profiles.get(userId), [userId]);

  if (exercises === undefined || weightLogs === undefined) {
    return <p className="p-4 text-sm text-zinc-400">Cargando…</p>;
  }

  const latestWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight_kg : null;
  const sex = profile?.sex === "male" || profile?.sex === "female" ? profile.sex : null;
  const latestScanWithLsi = (scans ?? []).find((s) => s.lsi_lower_limb_pct != null);

  const cards = exercises
    .map((exercise) => {
      const standard = getStrengthStandard(exercise.name);
      if (!standard || exercise.e1rm_kg == null) return null;

      const exerciseEstimates = (estimates ?? [])
        .filter((e) => e.exercise_id === exercise.id)
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      const latestMethod = exerciseEstimates[0]?.method ?? null;
      const isNrmEstimate = latestMethod != null && NRM_SOURCES.has(latestMethod);

      return { exercise, standard, latestMethod, isNrmEstimate };
    })
    .filter((c): c is NonNullable<typeof c> => c != null);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Estándares de fuerza</h1>

      {latestWeight == null && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Registrá tu peso para ver estándares.
        </div>
      )}

      {latestScanWithLsi?.lsi_lower_limb_pct != null &&
        (() => {
          const lsi = latestScanWithLsi.lsi_lower_limb_pct!;
          const interpretation = getLSIInterpretation(lsi);
          return (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">LSI piernas: {lsi.toFixed(1)}%</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">{interpretation.message}</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (lsi / 90) * 100)}%` }} />
              </div>
            </div>
          );
        })()}

      {latestWeight != null && sex == null && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Completá el sexo en tu perfil para ver el nivel de fuerza (los estándares son distintos por sexo).
        </p>
      )}

      {latestWeight != null &&
        sex != null &&
        cards.map(({ exercise, standard, isNrmEstimate }) => {
          const evaluation = evaluateStrengthLevel(exercise.e1rm_kg!, latestWeight, standard, sex);
          return (
            <div key={exercise.id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{exercise.name}</p>
                {isNrmEstimate && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                    Estimado por NRM
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {exercise.e1rm_kg!.toFixed(1)}kg · {evaluation.ratio.toFixed(2)}x tu peso
              </p>
              {isNrmEstimate && (
                <p className="text-xs text-zinc-400">Para dato preciso, hacer Día 1RM.</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_BADGE_COLOR[evaluation.currentLevel]}`}>
                  {LEVEL_LABEL[evaluation.currentLevel]}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{evaluation.message}</span>
              </div>
              {evaluation.percentToNextLevel != null && (
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full ${LEVEL_BAR_COLOR[evaluation.nextLevel ?? evaluation.currentLevel]}`}
                    style={{ width: `${evaluation.percentToNextLevel}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}

      {cards.length === 0 && latestWeight != null && (
        <p className="text-sm text-zinc-400">Todavía no hay e1RM registrado para ningún ejercicio con estándar.</p>
      )}

      <details open={disclaimerOpen} onToggle={(e) => setDisclaimerOpen((e.target as HTMLDetailsElement).open)} className="text-sm text-zinc-500 dark:text-zinc-400">
        <summary className="cursor-pointer font-medium">Sobre estos estándares</summary>
        <p className="mt-2">{STRENGTH_STANDARDS_DISCLAIMER}</p>
      </details>
    </div>
  );
}
