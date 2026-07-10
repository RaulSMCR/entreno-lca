"use client";

import { useEffect, useRef, useState } from "react";

// Adaptado de components/entrenar/RestTimer.tsx: misma mecánica (countdown,
// ±15s, "Saltar", vibración al llegar a 0), pero con duración fija en segundos
// en vez de derivarla de TrainingObjective — el protocolo de calibración trae
// sus propios tiempos de descanso (documento fuente), no los de entrenamiento
// normal (lib/training-theory.ts).
export function CalibrationRestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const onDoneRef = useRef(onDone);
  const firedRef = useRef(false);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (!firedRef.current) {
            firedRef.current = true;
            if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(200);
            onDoneRef.current();
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  function skip() {
    if (firedRef.current) return;
    firedRef.current = true;
    onDoneRef.current();
  }

  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
      <div className="flex w-full items-center justify-between">
        <span className="font-medium text-blue-900 dark:text-blue-100">Descanso</span>
        <span className="text-lg font-semibold tabular-nums text-blue-900 dark:text-blue-100">
          {minutes}:{String(secs).padStart(2, "0")}
        </span>
      </div>
      <div className="flex w-full gap-2">
        <button
          type="button"
          onClick={() => setRemaining((r) => Math.max(0, r - 15))}
          className="min-h-11 flex-1 rounded-lg border border-blue-300 text-sm text-blue-900 dark:border-blue-800 dark:text-blue-100"
        >
          −15s
        </button>
        <button
          type="button"
          onClick={() => setRemaining((r) => r + 15)}
          className="min-h-11 flex-1 rounded-lg border border-blue-300 text-sm text-blue-900 dark:border-blue-800 dark:text-blue-100"
        >
          +15s
        </button>
        <button
          type="button"
          onClick={skip}
          className="min-h-11 flex-1 rounded-lg border border-blue-300 text-sm font-medium text-blue-900 dark:border-blue-800 dark:text-blue-100"
        >
          Saltar descanso
        </button>
      </div>
    </div>
  );
}
