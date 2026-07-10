"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LocalTemplateSlot } from "@/lib/db";
import { resolveAvailableLoads, snapLoad, type EquipmentLoadConfig } from "@/lib/loads";
import { targetLoad } from "@/lib/engine";
import { getObjectiveFromSlot, type TrainingObjective } from "@/lib/training-theory";
import { SetRow } from "./SetRow";
import { RestTimer } from "./RestTimer";
import { PreSetCountdown } from "./PreSetCountdown";

const NO_EQUIPMENT: EquipmentLoadConfig = { load_mode: "range", min_kg: 0, max_kg: 0, step_kg: 0 };

export type VoicePrefill = { load: number | null; reps: number | null; rpe: number | null; ts: number };

function schemeLabel(slot: LocalTemplateSlot): string {
  if (slot.block === "principal") {
    const parts: string[] = [];
    if (slot.sets != null && slot.reps != null) parts.push(`${slot.sets}×${slot.reps}`);
    if (slot.pct_max != null) parts.push(`${slot.pct_max}%`);
    if (slot.rpe_target != null) parts.push(`RPE ${slot.rpe_target}`);
    return parts.join(" · ");
  }
  const parts: string[] = [];
  if (slot.reps_or_time) parts.push(slot.reps_or_time);
  if (slot.intensity_note) parts.push(slot.intensity_note);
  return parts.join(" · ");
}

export function SlotCard({
  slot,
  sessionId,
  userId,
  voicePrefill,
  objective,
  onExerciseComplete,
}: {
  slot: LocalTemplateSlot;
  sessionId: string;
  userId: string;
  voicePrefill?: VoicePrefill;
  /** T (timers): objetivo usado para el descanso/countdown entre series. Si no se pasa, se infiere del slot. */
  objective?: TrainingObjective;
  /** Se dispara una vez cuando se registran todas las series del ejercicio. */
  onExerciseComplete?: () => void;
}) {
  const exercise = useLiveQuery(() => db.exercises.get(slot.exercise_id), [slot.exercise_id]);
  const equipment = useLiveQuery(
    async () => (exercise?.equipment_id ? db.equipment.get(exercise.equipment_id) : undefined),
    [exercise?.equipment_id]
  );
  const logs = useLiveQuery(
    async () => {
      const all = await db.set_logs.where("session_id").equals(sessionId).toArray();
      return all.filter((l) => l.exercise_id === slot.exercise_id && l._deleted !== 1).sort((a, b) => a.set_number - b.set_number);
    },
    [sessionId, slot.exercise_id],
    []
  );
  const lastHistoricalLog = useLiveQuery(
    async () => {
      const all = await db.set_logs.where("exercise_id").equals(slot.exercise_id).toArray();
      const other = all.filter((l) => l.session_id !== sessionId).sort((a, b) => b.created_at.localeCompare(a.created_at));
      return other[0];
    },
    [slot.exercise_id, sessionId]
  );

  const numSets = slot.sets ?? 1;
  const nextOpenSetNumber = Array.from({ length: numSets }, (_, i) => i + 1).find(
    (setNumber) => !logs?.find((l) => l.set_number === setNumber)
  );
  const allSetsLogged = nextOpenSetNumber == null && numSets > 0;

  // T (timers): antes de la primera serie no hace falta descanso, solo el
  // countdown de preparación; entre series se muestra descanso y después el
  // countdown. Ninguno de los dos bloquea: son banners informativos.
  const [preparedSetNumber, setPreparedSetNumber] = useState<number | null>(null);
  const [phase, setPhase] = useState<"rest" | "countdown" | "done">("done");

  // Ajuste de estado durante el render (no en un efecto) cuando cambia cuál es
  // la próxima serie sin registrar: patrón recomendado por React para derivar
  // estado a partir de otro estado/prop, sin el round-trip extra de un efecto.
  if (nextOpenSetNumber != null && preparedSetNumber !== nextOpenSetNumber) {
    setPreparedSetNumber(nextOpenSetNumber);
    setPhase(nextOpenSetNumber > 1 ? "rest" : "countdown");
  }

  const completeFiredRef = useRef(false);
  useEffect(() => {
    if (allSetsLogged && !completeFiredRef.current) {
      completeFiredRef.current = true;
      onExerciseComplete?.();
    }
    if (!allSetsLogged) completeFiredRef.current = false;
  }, [allSetsLogged, onExerciseComplete]);

  if (!exercise) return null;

  const resolvedObjective = objective ?? getObjectiveFromSlot(slot, exercise.unit);
  const equipmentConfig: EquipmentLoadConfig = (equipment as EquipmentLoadConfig | undefined) ?? NO_EQUIPMENT;
  const loadOptions = exercise.unit === "kg" ? resolveAvailableLoads(equipmentConfig) : [];

  let target: { ideal: number; real: number } | null = null;
  if (exercise.unit === "kg" && slot.block === "principal" && slot.pct_max != null && exercise.e1rm_kg != null) {
    target = targetLoad(exercise.e1rm_kg, slot.pct_max, equipmentConfig);
  }

  const defaults = {
    load: target?.real ?? lastHistoricalLog?.actual_load_kg ?? loadOptions[0] ?? null,
    reps: slot.reps ?? lastHistoricalLog?.actual_reps ?? null,
    rpe: slot.rpe_target ?? lastHistoricalLog?.rpe_reported ?? 8,
  };

  const targetLabel = target ? `Objetivo ${target.real}kg · ideal ${target.ideal.toFixed(1)}` : null;
  const snappedVoicePrefill: VoicePrefill | undefined = voicePrefill && {
    ...voicePrefill,
    load:
      voicePrefill.load != null && exercise.unit === "kg"
        ? snapLoad(voicePrefill.load, equipmentConfig, "nearest").real
        : voicePrefill.load,
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <p className="font-medium text-zinc-900 dark:text-zinc-50">{exercise.name}</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {slot.block} · {schemeLabel(slot)}
        </p>
      </div>

      {Array.from({ length: numSets }, (_, i) => i + 1).map((setNumber) => {
        const rowVoicePrefill = setNumber === nextOpenSetNumber ? snappedVoicePrefill : undefined;
        const showPrepBanner = setNumber === nextOpenSetNumber && phase !== "done";
        return (
          <div
            key={rowVoicePrefill ? `${setNumber}-${rowVoicePrefill.ts}` : setNumber}
            className="flex flex-col gap-2"
          >
            {showPrepBanner && phase === "rest" && (
              <RestTimer objective={resolvedObjective} onDone={() => setPhase("countdown")} />
            )}
            {showPrepBanner && phase === "countdown" && (
              <PreSetCountdown objective={resolvedObjective} onDone={() => setPhase("done")} />
            )}
            <SetRow
              sessionId={sessionId}
              userId={userId}
              exerciseId={slot.exercise_id}
              setNumber={setNumber}
              unit={exercise.unit as "kg" | "seconds" | "meters" | "intervals" | "reps"}
              loadOptions={loadOptions}
              defaults={defaults}
              existing={logs?.find((l) => l.set_number === setNumber)}
              targetLabel={targetLabel}
              voicePrefill={rowVoicePrefill}
            />
          </div>
        );
      })}
    </div>
  );
}
