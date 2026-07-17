"use client";

import { useState } from "react";

export type AlternativeCandidate = { id: string; name: string };

// R-4 Parte B.4 — "Buscar ejercicio alternativo": por ahora solo lista
// candidatos del mismo bloque en la plantilla actual (no hace swap
// automático). Cuando hay onSuggestToTrainer (contexto post-sesión, con un
// skip real al que atarle la nota) también ofrece dejar la sugerencia en
// skip_note; en el briefing pre-sesión no hay skip todavía, así que ese botón
// no se muestra.
export function AlternativeExercisePanel({
  exerciseName,
  candidates,
  onClose,
  onSuggestToTrainer,
}: {
  exerciseName: string;
  candidates: AlternativeCandidate[];
  onClose: () => void;
  onSuggestToTrainer?: (candidateName: string | null) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function suggest() {
    if (!onSuggestToTrainer) return;
    const candidateName = candidates.find((c) => c.id === selectedId)?.name ?? null;
    onSuggestToTrainer(candidateName);
    setSent(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <div className="w-full max-w-md rounded-t-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 md:rounded-2xl">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Alternativas a {exerciseName}</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Ejercicios del mismo bloque en el plan de hoy. Elegir uno no lo reemplaza automáticamente.
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {candidates.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No hay otros ejercicios del mismo bloque hoy.</p>
          )}
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={selectedId === c.id ? "true" : "false"}
              onClick={() => setSelectedId(c.id)}
              className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm ${
                selectedId === c.id
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {onSuggestToTrainer && (
          <div className="mt-4">
            {sent ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">✅ Sugerencia guardada en la sesión.</p>
            ) : (
              <button
                type="button"
                onClick={suggest}
                className="min-h-11 w-full rounded-lg border border-zinc-300 px-4 py-3 text-center text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
              >
                Sugerir alternativa al entrenador
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-2 min-h-11 w-full rounded-lg bg-accent-600 px-4 py-3 text-center font-medium text-brand-950"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
