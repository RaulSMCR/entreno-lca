"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { pullRemote } from "@/lib/sync";
import { isCalibrationSessionEnabled, type CalibrationSessionType, type RehabPhase } from "@/lib/calibration";

const SESSION_INFO: Record<CalibrationSessionType, { title: string; subtitle: string }> = {
  A: { title: "Sesión A", subtitle: "Tren superior — empuje/tracción principal (~70 min)" },
  B: { title: "Sesión B", subtitle: "Tren superior — remo y accesorios (~65 min)" },
  C: { title: "Sesión C", subtitle: "Grip, core, potencia y cardio (~65 min)" },
  D: { title: "Sesión D", subtitle: "Pierna sana + spot check (~45 min)" },
  "1RM_day": { title: "Día 1RM", subtitle: "Protocolo NSCA directo (~150 min)" },
};

const SESSION_ORDER: CalibrationSessionType[] = ["A", "B", "C", "D", "1RM_day"];

export function CalibracionHomeClient({ rehabPhase }: { rehabPhase: RehabPhase | null }) {
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      pullRemote().catch(() => {});
    }
  }, []);

  const sessions = useLiveQuery(() => db.calibration_sessions.toCollection().filter((s) => s._deleted !== 1).toArray(), [], []);

  function lastDoneAt(sessionType: CalibrationSessionType): string | null {
    const matches = (sessions ?? []).filter((s) => s.session_type === sessionType);
    if (matches.length === 0) return null;
    return matches.reduce((latest, s) => (s.performed_at > latest ? s.performed_at : latest), matches[0].performed_at);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Calibración</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Protocolos para establecer y actualizar tus cargas de referencia (e1RM).
      </p>

      <div className="flex flex-col gap-3">
        {SESSION_ORDER.map((sessionType) => {
          const info = SESSION_INFO[sessionType];
          const gate = isCalibrationSessionEnabled(sessionType, rehabPhase);
          const done = lastDoneAt(sessionType);

          return (
            <div key={sessionType} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{info.title}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{info.subtitle}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {done ? `Completada: ${new Date(done).toLocaleDateString()}` : "Pendiente"}
                  </p>
                </div>
                {gate.enabled ? (
                  <Link
                    href={`/calibracion/${sessionType}`}
                    className="min-h-11 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
                  >
                    {done ? "Repetir" : "Iniciar"}
                  </Link>
                ) : (
                  <span className="text-xs text-zinc-400">No habilitada</span>
                )}
              </div>
              {!gate.enabled && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{gate.reason}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
