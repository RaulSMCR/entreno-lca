"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { db, newId, nowIso, type LocalEquipment, type LocalExercise } from "@/lib/db";
import { pullRemote } from "@/lib/sync";
import { todayIso } from "@/lib/date";
import { updateE1rmFromCalibration } from "@/lib/engine";
import type { EquipmentLoadConfig } from "@/lib/loads";
import { CALIBRATION_SESSION_EXERCISES, type RehabPhase } from "@/lib/calibration";
import {
  buildProtocolPhases,
  getDeterminedE1RM,
  getNextAttempt,
  type ProtocolAttempt,
  type ProtocolPhase,
} from "@/lib/1rm-protocol";
import { CalibrationRestTimer } from "./CalibrationRestTimer";

const EXERCISE_NAMES = CALIBRATION_SESSION_EXERCISES["1RM_day"];

type ExerciseResult = { exerciseName: string; determinedE1rmKg: number | null };

export function OneRmDayFlow({ userId, rehabPhase }: { userId: string; rehabPhase: RehabPhase | null }) {
  const [exercises, setExercises] = useState<LocalExercise[] | null>(null);
  const [equipmentById, setEquipmentById] = useState<Map<string, LocalEquipment>>(new Map());
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        await pullRemote().catch(() => {});
      }
      if (cancelled) return;
      const rows = await db.exercises.toCollection().filter((r) => EXERCISE_NAMES.includes(r.name)).toArray();
      const byName = new Map(rows.map((r) => [r.name, r]));
      const ordered = EXERCISE_NAMES.map((n) => byName.get(n)).filter((r): r is LocalExercise => r != null);

      const equipmentIds = Array.from(new Set(ordered.map((e) => e.equipment_id).filter((id): id is string => id != null)));
      const equipmentRows = await db.equipment.bulkGet(equipmentIds);
      const map = new Map(equipmentRows.filter((e): e is LocalEquipment => e != null).map((e) => [e.id, e]));

      if (!cancelled) {
        setExercises(ordered);
        setEquipmentById(map);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (exercises === null) {
    return <p className="p-4 text-sm text-zinc-400">Cargando…</p>;
  }

  if (exerciseIndex >= exercises.length) {
    if (!saved) {
      void (async () => {
        const now = nowIso();
        await db.calibration_sessions.put({
          id: newId(),
          user_id: userId,
          session_type: "1RM_day",
          performed_at: now,
          notes: JSON.stringify(results.map((r) => ({ exercise: r.exerciseName, e1rm_kg: r.determinedE1rmKg }))),
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
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Día 1RM completado</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Estos 3 e1RM anclan el 100% de tu plan de rendimiento.
        </p>
        <ul className="flex flex-col gap-2 text-sm">
          {results.map((r) => (
            <li key={r.exerciseName} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{r.exerciseName}</p>
              <p className="text-zinc-500 dark:text-zinc-400">
                {r.determinedE1rmKg != null ? `e1RM determinado: ${r.determinedE1rmKg.toFixed(1)}kg` : "Ningún intento exitoso"}
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
        <Link href="/perfil" className="min-h-11 rounded-lg border border-zinc-300 px-4 py-2 text-center text-sm font-medium dark:border-zinc-700">
          Volver a pantalla principal
        </Link>
      </div>
    );
  }

  const exercise = exercises[exerciseIndex];
  const equipment = exercise.equipment_id ? equipmentById.get(exercise.equipment_id) : undefined;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Día 1RM</h1>
        <span className="text-sm text-zinc-400">
          {exerciseIndex + 1} / {exercises.length}
        </span>
      </div>
      <OneRmExercise
        key={exercise.id}
        exercise={exercise}
        equipment={equipment}
        onComplete={async (determinedE1rmKg) => {
          if (determinedE1rmKg != null) {
            const result = updateE1rmFromCalibration({ e1rm_kg: exercise.e1rm_kg }, determinedE1rmKg, "direct_1rm_protocol");
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
              method: "direct_1rm_protocol",
              source_session_id: null,
              _dirty: 1,
              _deleted: 0,
            });
          }
          setResults((prev) => [...prev, { exerciseName: exercise.name, determinedE1rmKg }]);
          setExerciseIndex((i) => i + 1);
        }}
      />
    </div>
  );
}

function OneRmExercise({
  exercise,
  equipment,
  onComplete,
}: {
  exercise: LocalExercise;
  equipment: LocalEquipment | undefined;
  onComplete: (determinedE1rmKg: number | null) => void;
}) {
  const equipmentConfig = equipment as EquipmentLoadConfig | undefined;
  const ctx = useMemo(
    () => ({ exercise: { name: exercise.name }, current_e1rm_kg: exercise.e1rm_kg ?? 0, equipment: equipmentConfig }),
    [exercise.name, exercise.e1rm_kg, equipmentConfig]
  );
  const basePhases = useMemo(() => buildProtocolPhases(ctx), [ctx]);

  const [warmupStep, setWarmupStep] = useState(0);
  const [attempts, setAttempts] = useState<ProtocolAttempt[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState<ProtocolPhase | null>(null);
  const [resting, setResting] = useState(false);

  const inWarmup = warmupStep < 3;
  // basePhases[3] es el primer intento, determinístico a partir de ctx — no
  // hace falta un efecto para "inicializarlo": si todavía no se logueó ningún
  // intento (currentAttempt sigue null recién salido del calentamiento), cae
  // en ese valor derivado en vez de disparar un setState extra.
  const phase: ProtocolPhase | null = inWarmup ? basePhases[warmupStep] : (currentAttempt ?? basePhases[3]);

  if (!phase) return <p className="text-sm text-zinc-400">Preparando…</p>;

  function finishWarmupStep() {
    setResting(true);
  }

  function logAttempt(success: boolean) {
    if (!phase) return;
    setAttempts((prev) => [...prev, { pctOfE1rm: phase.pctOfE1rm, loadKg: phase.targetLoadKg, success }]);
    setResting(true);
  }

  // `attempts` ya refleja el intento recién logueado en este render (setAttempts
  // se resuelve antes de que el usuario pueda terminar el descanso y disparar
  // esto), así que alcanza con leerlo directamente — no hace falta un ref.
  function handleRestDone() {
    setResting(false);
    if (inWarmup) {
      setWarmupStep((s) => s + 1);
      return;
    }
    const next = getNextAttempt(attempts, ctx);
    if (next.done) {
      onComplete(getDeterminedE1RM(attempts));
      return;
    }
    setCurrentAttempt(next.attempt);
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="font-medium text-zinc-900 dark:text-zinc-50">{exercise.name}</p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {inWarmup ? `Calentamiento ${warmupStep + 1}/3` : `Intento ${attempts.length + 1}`}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {phase.targetLoadKg.toFixed(1)}kg × {phase.reps}
      </p>

      {resting ? (
        <div className="mt-3">
          <CalibrationRestTimer seconds={phase.restSeconds} onDone={handleRestDone} />
        </div>
      ) : inWarmup ? (
        <button
          type="button"
          onClick={finishWarmupStep}
          className="mt-3 min-h-11 w-full rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
        >
          Hecho
        </button>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => logAttempt(true)}
            className="min-h-11 flex-1 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white"
          >
            Logrado
          </button>
          <button
            type="button"
            onClick={() => logAttempt(false)}
            className="min-h-11 flex-1 rounded-lg bg-red-600 px-4 py-2 font-medium text-white"
          >
            Fallido
          </button>
        </div>
      )}
    </div>
  );
}
