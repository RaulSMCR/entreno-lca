"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type LocalTemplateSlot } from "@/lib/db";
import { resolveAvailableLoads, type EquipmentLoadConfig } from "@/lib/loads";
import { targetLoad } from "@/lib/engine";
import { SetRow } from "./SetRow";

const NO_EQUIPMENT: EquipmentLoadConfig = { load_mode: "range", min_kg: 0, max_kg: 0, step_kg: 0 };

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

export function SlotCard({ slot, sessionId, userId }: { slot: LocalTemplateSlot; sessionId: string; userId: string }) {
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

  if (!exercise) return null;

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
  const numSets = slot.sets ?? 1;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <p className="font-medium text-zinc-900 dark:text-zinc-50">{exercise.name}</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {slot.block} · {schemeLabel(slot)}
        </p>
      </div>

      {Array.from({ length: numSets }, (_, i) => i + 1).map((setNumber) => (
        <SetRow
          key={setNumber}
          sessionId={sessionId}
          userId={userId}
          exerciseId={slot.exercise_id}
          setNumber={setNumber}
          unit={exercise.unit as "kg" | "seconds" | "meters" | "intervals" | "reps"}
          loadOptions={loadOptions}
          defaults={defaults}
          existing={logs?.find((l) => l.set_number === setNumber)}
          targetLabel={targetLabel}
        />
      ))}
    </div>
  );
}
