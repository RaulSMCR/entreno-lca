"use client";

import { useEffect, useState } from "react";
import type { SkipReason } from "@/lib/session-exercise";

const REASONS: { value: SkipReason; icon: string; label: string; description: string }[] = [
  {
    value: "station_occupied",
    icon: "🚧",
    label: "Estación ocupada",
    description: "Otro atleta está usando el espacio o el equipo",
  },
  {
    value: "equipment_unavailable",
    icon: "🔧",
    label: "Equipo no disponible",
    description: "No encontrás las pesas, falta una pieza o hay un problema técnico",
  },
  {
    value: "physical_discomfort",
    icon: "🩹",
    label: "Molestia física",
    description: "Sentís incomodidad, dolor o preferís no ejecutar este ejercicio hoy",
  },
  { value: "no_time", icon: "⏰", label: "Sin tiempo", description: "La sesión se está extendiendo y necesitás terminar" },
  { value: "other", icon: "📝", label: "Otro motivo", description: "" },
];

export function SkipModal({
  exerciseName,
  setsCompleted,
  setsPlanned,
  onSkip,
  onCancel,
  onMarkPartial,
}: {
  exerciseName: string;
  setsCompleted: number;
  setsPlanned: number;
  onSkip: (reason: SkipReason, note?: string) => void;
  onCancel: () => void;
  onMarkPartial: () => void;
}) {
  const [reason, setReason] = useState<SkipReason | null>(null);
  const [note, setNote] = useState("");
  // El tip con delay solo aplica a station_occupied/equipment_unavailable; para
  // physical_discomfort se muestra de inmediato sin pasar por el timer.
  const [delayedTipReason, setDelayedTipReason] = useState<SkipReason | null>(null);

  useEffect(() => {
    if (reason !== "station_occupied" && reason !== "equipment_unavailable") return;
    const t = setTimeout(() => setDelayedTipReason(reason), 500);
    return () => clearTimeout(t);
  }, [reason]);

  const showTip = reason === "physical_discomfort" || delayedTipReason === reason;

  function confirmSkip() {
    if (!reason) return;
    onSkip(reason, note.trim() || undefined);
  }

  const canConfirm = reason != null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <div className="w-full max-w-md overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 md:max-h-[90vh] md:rounded-2xl">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">¿Por qué omitís {exerciseName}?</h2>
        {setsCompleted > 0 && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Completaste {setsCompleted} de {setsPlanned} series
          </p>
        )}

        <div className="mt-3 flex flex-col gap-2">
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={reason === r.value ? "true" : "false"}
              onClick={() => setReason(r.value)}
              className={`min-h-11 rounded-lg border px-3 py-2 text-left ${
                reason === r.value
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              <span className="font-medium">
                {r.icon} {r.label}
              </span>
              {r.description && (
                <span className={`block text-xs ${reason === r.value ? "opacity-80" : "text-zinc-500 dark:text-zinc-400"}`}>
                  {r.description}
                </span>
              )}
            </button>
          ))}
        </div>

        {(reason === "other" || reason === "physical_discomfort") && (
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={reason === "other" ? "Contanos qué pasó" : "Detalle opcional de la molestia (opcional)"}
            className="mt-2 min-h-20 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        )}

        {showTip && (reason === "station_occupied" || reason === "equipment_unavailable") && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            💡 Podés intentar {exerciseName} más tarde en la sesión si se libera.
          </p>
        )}
        {showTip && reason === "physical_discomfort" && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            Anotá la molestia registrada para el análisis. Si persiste, consultá a tu médico.
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {setsCompleted > 0 && (
            <button
              type="button"
              onClick={onMarkPartial}
              className="min-h-11 rounded-lg border border-zinc-300 px-4 py-3 text-center font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            >
              Marcar parcial y seguir
            </button>
          )}
          <button
            type="button"
            disabled={!canConfirm}
            onClick={confirmSkip}
            className="min-h-11 rounded-lg bg-red-600 px-4 py-3 text-center font-medium text-white disabled:opacity-40"
          >
            {setsCompleted > 0 ? "Omitir por completo" : "Confirmar omisión"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-lg px-4 py-3 text-center text-sm text-zinc-500 dark:text-zinc-400"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
