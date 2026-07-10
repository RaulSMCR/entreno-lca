"use client";

import { useEffect, useRef, useState } from "react";
import { BEAT_SECONDS_BY_OBJECTIVE, type TrainingObjective } from "@/lib/training-theory";

// T (timers): countdown "3, 2, 1" previo a una serie no registrada todavía.
// Breve y salteable — no bloquea, solo da un momento de preparación.
export function PreSetCountdown({
  objective,
  onDone,
}: {
  objective: TrainingObjective;
  onDone: () => void;
}) {
  const beatSeconds = BEAT_SECONDS_BY_OBJECTIVE[objective];
  const [beat, setBeat] = useState(3);
  const onDoneRef = useRef(onDone);
  const firedRef = useRef(false);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const id = setInterval(() => {
      setBeat((b) => {
        if (b <= 1) {
          if (!firedRef.current) {
            firedRef.current = true;
            onDoneRef.current();
          }
          return 0;
        }
        return b - 1;
      });
    }, beatSeconds * 1000);
    return () => clearInterval(id);
  }, [beatSeconds]);

  function skip() {
    if (firedRef.current) return;
    firedRef.current = true;
    onDoneRef.current();
  }

  if (beat <= 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950">
      <span className="text-amber-900 dark:text-amber-100">
        Preparate… <span className="text-lg font-semibold tabular-nums">{beat}</span>
      </span>
      <button
        type="button"
        onClick={skip}
        className="min-h-11 rounded-lg border border-amber-300 px-3 text-sm text-amber-900 dark:border-amber-800 dark:text-amber-100"
      >
        Saltar
      </button>
    </div>
  );
}
