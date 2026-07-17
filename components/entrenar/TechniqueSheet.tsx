"use client";

// P (preparación pre-serie): ficha técnica del primer ejercicio de la sesión.
// Se muestra una sola vez por sesión (la gatilla WorkoutSetFlow), usando
// exercises.biomech_note, que ya viene poblado en el seed con notas reales.
export function TechniqueSheet({
  exerciseName,
  biomechNote,
  onAcknowledge,
}: {
  exerciseName: string;
  biomechNote: string | null;
  onAcknowledge: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <div className="w-full max-w-md rounded-t-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 md:rounded-2xl">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Antes de arrancar</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{exerciseName}</h2>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          {biomechNote ?? "Prestá atención a la técnica: controlá el descenso y mantené la postura."}
        </p>
        <button
          type="button"
          onClick={onAcknowledge}
          className="mt-4 min-h-11 w-full rounded-lg bg-accent-600 px-4 py-3 text-center font-medium text-brand-950"
        >
          Entendido, empezar
        </button>
      </div>
    </div>
  );
}
