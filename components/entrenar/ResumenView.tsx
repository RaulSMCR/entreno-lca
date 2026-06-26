"use client";

import type { SessionSummary } from "./SesionView";
import { SyncStatus } from "@/components/SyncStatus";

const ACTION_LABEL: Record<string, string> = {
  increase: "Subí",
  maintain: "Mantené",
  repeat: "Repetí",
  decrease: "Bajá",
};

export function ResumenView({ summary, onClose }: { summary: SessionSummary[]; onClose: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Resumen de la sesión</h1>
        <SyncStatus />
      </div>

      {summary.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No se registró ninguna serie en esta sesión.</p>
      )}

      {summary.map((item, i) => (
        <div
          key={i}
          className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <p className="font-medium text-zinc-900 dark:text-zinc-50">{item.exerciseName}</p>

          {item.kind === "load" ? (
            <>
              {item.e1rmUpdated ? (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  e1RM: {item.oldE1rm ?? "—"}kg → {item.newE1rm.toFixed(1)}kg
                </p>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">e1RM sin cambios ({item.oldE1rm ?? "—"}kg)</p>
              )}
              {item.suggestion && (
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">
                    {ACTION_LABEL[item.suggestion.action] ?? item.suggestion.action} a {item.suggestion.real}kg.
                  </span>{" "}
                  {item.suggestion.reason}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Objetivo a batir: {item.target} {item.unit}
              {item.isPR && <span className="ml-2 font-medium text-emerald-600 dark:text-emerald-400">¡PR! 🏆</span>}
            </p>
          )}
        </div>
      ))}

      <button
        onClick={onClose}
        className="rounded-lg bg-zinc-900 px-4 py-3 text-center font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
      >
        Listo
      </button>
    </div>
  );
}
