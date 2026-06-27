import type { LocalE1rmEstimate, LocalExercise } from "@/lib/db";
import { deloadSuggestion, projectE1rm, type TrendPoint } from "@/lib/progress";
import { E1rmChart } from "./E1rmChart";

const DEFAULT_DELOAD_PCT = 10;

const REASON_LABEL: Record<string, string> = {
  stagnation: "sin mejora reciente",
  chronic_high_rpe: "RPE crónicamente alto",
};

export function ExerciseProgressCard({
  exercise,
  estimates,
  recentRpeAvgs,
}: {
  exercise: LocalExercise;
  estimates: LocalE1rmEstimate[];
  recentRpeAvgs: number[];
}) {
  const history: TrendPoint[] = [...estimates]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ date: e.date, e1rm: e.e1rm_kg }));

  const projection = projectE1rm(history);
  const deload = deloadSuggestion(history, recentRpeAvgs);
  const deloadLoad = exercise.e1rm_kg != null ? exercise.e1rm_kg * (1 - DEFAULT_DELOAD_PCT / 100) : null;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <p className="font-medium text-zinc-900 dark:text-zinc-50">{exercise.name}</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          e1RM actual: {exercise.e1rm_kg != null ? `${exercise.e1rm_kg.toFixed(1)}kg` : "—"}
        </p>
      </div>

      <E1rmChart history={history} />

      {projection != null && (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Proyección a 4 semanas: ~{projection.toFixed(1)}kg
        </p>
      )}

      {deload.suggested && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-semibold">
            ⚠ Deload sugerido{deloadLoad != null ? `: probá ~${deloadLoad.toFixed(1)}kg` : ""}
          </p>
          <p className="text-sm opacity-90">{deload.reasons.map((r) => REASON_LABEL[r] ?? r).join(" + ")}.</p>
        </div>
      )}
    </div>
  );
}
