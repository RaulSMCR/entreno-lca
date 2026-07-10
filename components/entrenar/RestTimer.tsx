"use client";

import { useEffect, useRef, useState } from "react";
import { PRESCRIBED_REST_SECONDS, type TrainingObjective } from "@/lib/training-theory";

// T (timers): descanso no bloqueante entre series — banner con countdown,
// ajuste ±15s y "Saltar descanso". No impide seguir usando la app mientras
// corre.
export function RestTimer({
  objective,
  onDone,
}: {
  objective: TrainingObjective;
  onDone: () => void;
}) {
  const recommended = PRESCRIBED_REST_SECONDS[objective].recommended;
  const [remaining, setRemaining] = useState(recommended);
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
  const seconds = remaining % 60;

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
      <div className="flex w-full items-center justify-between">
        <span className="font-medium text-blue-900 dark:text-blue-100">Descanso</span>
        <span className="text-lg font-semibold tabular-nums text-blue-900 dark:text-blue-100">
          {minutes}:{String(seconds).padStart(2, "0")}
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
