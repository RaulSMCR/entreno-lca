"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db, newId, nowIso, type LocalExercise } from "@/lib/db";
import { pullRemote } from "@/lib/sync";
import { todayIso } from "@/lib/date";
import { updateE1rmFromCalibration, type CalibrationE1rmSource } from "@/lib/engine";
import {
  CALIBRATION_SESSION_EXERCISES,
  EXERCISE_CALIBRATION_MAP,
  estimateE1RMFromNRM,
  type CalibrationProtocol,
  type CalibrationSessionType,
  type RehabPhase,
} from "@/lib/calibration";
import { CalibrationRestTimer } from "./CalibrationRestTimer";
import { OneRmDayFlow } from "./OneRmDayFlow";

const REPS_BY_RM_PROTOCOL: Partial<Record<CalibrationProtocol, number>> = {
  five_rm: 5,
  ten_rm: 10,
  twelve_rm: 12,
  fifteen_rm: 15,
};

const SOURCE_BY_RM_PROTOCOL: Partial<Record<CalibrationProtocol, CalibrationE1rmSource>> = {
  five_rm: "five_rm_test",
  ten_rm: "ten_rm_test",
  twelve_rm: "twelve_rm_test",
  fifteen_rm: "fifteen_rm_test",
};

const REST_SECONDS_BY_PROTOCOL: Record<CalibrationProtocol, number> = {
  direct_1rm: 240,
  five_rm: 180,
  ten_rm: 180,
  twelve_rm: 180,
  fifteen_rm: 180,
  time_hold: 120,
  distance_load: 120,
  power_output: 120,
  mobility_rpe: 0,
};

function inputConfig(protocol: CalibrationProtocol, exercise: LocalExercise): { label: string; instruction: string } {
  const reps = REPS_BY_RM_PROTOCOL[protocol];
  if (reps) {
    return {
      label: `Carga levantada a ${reps} reps (kg)`,
      instruction: `Test de ${reps}RM: buscá la carga máxima con la que completás ${reps} repeticiones a fallo técnico.`,
    };
  }
  if (protocol === "time_hold") {
    return { label: "Tiempo sostenido (segundos)", instruction: "Sostené la posición el mayor tiempo posible con técnica correcta." };
  }
  if (protocol === "distance_load") {
    return { label: "Carga cargada (kg)", instruction: "Cargá la máxima carga posible manteniendo la postura recta durante 30 metros." };
  }
  if (protocol === "power_output") {
    if (exercise.unit === "meters") {
      return { label: "Distancia (m)", instruction: "Máxima distancia posible en el tiempo prescrito, a intensidad máxima." };
    }
    return { label: "Reps completadas", instruction: "Máximas repeticiones a máxima velocidad en el tiempo prescrito." };
  }
  return { label: "RPE de restricción (0-10)", instruction: "Registrá el RPE de restricción de rango de movimiento (no hay carga)." };
}

type ExerciseResult = { exerciseName: string; protocol: CalibrationProtocol; value: number; e1rmKg: number | null };

export function CalibracionSessionClient({
  userId,
  sessionType,
  rehabPhase,
}: {
  userId: string;
  sessionType: CalibrationSessionType;
  rehabPhase: RehabPhase | null;
}) {
  if (sessionType === "1RM_day") {
    return <OneRmDayFlow userId={userId} rehabPhase={rehabPhase} />;
  }
  return <GenericCalibrationFlow userId={userId} sessionType={sessionType} rehabPhase={rehabPhase} />;
}

function GenericCalibrationFlow({
  userId,
  sessionType,
  rehabPhase,
}: {
  userId: string;
  sessionType: CalibrationSessionType;
  rehabPhase: RehabPhase | null;
}) {
  const [exercises, setExercises] = useState<LocalExercise[] | null>(null);
  const [index, setIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [resting, setResting] = useState(false);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        await pullRemote().catch(() => {});
      }
      if (cancelled) return;
      const names = CALIBRATION_SESSION_EXERCISES[sessionType];
      const rows = await db.exercises.where("name").anyOf(names).toArray();
      const byName = new Map(rows.map((r) => [r.name, r]));
      const ordered = names.map((n) => byName.get(n)).filter((r): r is LocalExercise => r != null);
      if (!cancelled) setExercises(ordered);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionType]);

  if (exercises === null) {
    return <p className="p-4 text-sm text-zinc-400">Cargando…</p>;
  }

  if (index >= exercises.length) {
    if (!saved) {
      void (async () => {
        const now = nowIso();
        await db.calibration_sessions.put({
          id: newId(),
          user_id: userId,
          session_type: sessionType,
          performed_at: now,
          notes: JSON.stringify(
            results.map((r) => ({ exercise: r.exerciseName, protocol: r.protocol, value: r.value, e1rm_kg: r.e1rmKg }))
          ),
          rehab_phase_at_time: rehabPhase,
          created_at: now,
          updated_at: now,
          _dirty: 1,
          _deleted: 0,
        });
        setSaved(true);
      })();
    }

    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Sesión {sessionType} completada</h1>
        <ul className="flex flex-col gap-2 text-sm">
          {results.map((r) => (
            <li key={r.exerciseName} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{r.exerciseName}</p>
              <p className="text-zinc-500 dark:text-zinc-400">
                Registrado: {r.value}
                {r.e1rmKg != null && ` · e1RM: ${r.e1rmKg.toFixed(1)}kg`}
              </p>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Link href="/calibracion" className="min-h-11 flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-center text-sm font-medium dark:border-zinc-700">
            Volver a calibración
          </Link>
          <Link href="/perfil/fuerza" className="min-h-11 flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900">
            Ver estándares
          </Link>
        </div>
      </div>
    );
  }

  const exercise = exercises[index];
  const protocol = EXERCISE_CALIBRATION_MAP[exercise.name];
  const config = inputConfig(protocol, exercise);
  const restSeconds = REST_SECONDS_BY_PROTOCOL[protocol];

  async function handleRegister() {
    const value = Number(inputValue);
    if (!Number.isFinite(value)) {
      setError("Ingresá un valor válido.");
      return;
    }
    setError(null);

    const reps = REPS_BY_RM_PROTOCOL[protocol];
    const source = SOURCE_BY_RM_PROTOCOL[protocol];
    let e1rmKg: number | null = null;

    if (reps && source) {
      e1rmKg = estimateE1RMFromNRM(value, reps);
      const result = updateE1rmFromCalibration({ e1rm_kg: exercise.e1rm_kg }, e1rmKg, source);
      if (result.updated) {
        const now = nowIso();
        await db.exercises.update(exercise.id, { e1rm_kg: result.e1rm, updated_at: now, _dirty: 1 });
        await db.e1rm_estimates.put({
          id: newId(),
          user_id: userId,
          created_at: now,
          updated_at: now,
          exercise_id: exercise.id,
          date: todayIso(),
          e1rm_kg: result.e1rm,
          method: source,
          source_session_id: null,
          _dirty: 1,
          _deleted: 0,
        });
      }
    }

    setResults((prev) => [...prev, { exerciseName: exercise.name, protocol, value, e1rmKg }]);
    setInputValue("");
    if (restSeconds > 0) {
      setResting(true);
    } else {
      setIndex((i) => i + 1);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Sesión {sessionType}</h1>
        <span className="text-sm text-zinc-400">
          {index + 1} / {exercises.length}
        </span>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="font-medium text-zinc-900 dark:text-zinc-50">{exercise.name}</p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{config.instruction}</p>

        {resting ? (
          <div className="mt-3">
            <CalibrationRestTimer seconds={restSeconds} onDone={() => { setResting(false); setIndex((i) => i + 1); }} />
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-sm">
              {config.label}
              <input
                inputMode="decimal"
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-2xl font-semibold tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button
              type="button"
              onClick={handleRegister}
              className="min-h-11 rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              Registrar y continuar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
