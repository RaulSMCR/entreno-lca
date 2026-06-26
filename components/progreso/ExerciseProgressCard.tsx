import type { LocalE1rmEstimate, LocalExercise } from "@/lib/db";
import { isStagnant, projectE1rm, type TrendPoint } from "@/lib/progress";
import { Sparkline } from "./Sparkline";

export function ExerciseProgressCard({
  exercise,
  estimates,
}: {
  exercise: LocalExercise;
  estimates: LocalE1rmEstimate[];
}) {
  const history: TrendPoint[] = [...estimates]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ date: e.date, e1rm: e.e1rm_kg }));

  const projection = projectE1rm(history);
  const stagnant = isStagnant(history);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-zinc-900 dark:text-zinc-50">{exercise.name}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            e1RM actual: {exercise.e1rm_kg != null ? `${exercise.e1rm_kg.toFixed(1)}kg` : "—"}
          </p>
        </div>
        <Sparkline values={history.map((h) => h.e1rm)} />
      </div>

      {projection != null && (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Proyección a 4 semanas: ~{projection.toFixed(1)}kg
        </p>
      )}

      {stagnant && (
        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
          ⚠ Estancamiento: sin mejora reciente — considerá un deload.
        </p>
      )}

      {history.length === 0 && (
        <p className="text-sm text-zinc-400">Sin estimaciones registradas todavía.</p>
      )}
    </div>
  );
}
