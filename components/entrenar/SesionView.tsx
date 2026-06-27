"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, newId, nowIso, type LocalSession } from "@/lib/db";
import { todayIso } from "@/lib/date";
import { SyncStatus } from "@/components/SyncStatus";
import { SlotCard, type VoicePrefill } from "./SlotCard";
import { VoiceCapture, type VoiceContextExercise } from "./VoiceCapture";
import { suggestNextLoad, suggestNextTarget, updateE1rm, type LoadSuggestion } from "@/lib/engine";
import { resolveAvailableLoads, type EquipmentLoadConfig } from "@/lib/loads";
import type { VoiceParsedSet } from "@/app/api/parse-voice/route";

const NO_EQUIPMENT: EquipmentLoadConfig = { load_mode: "range", min_kg: 0, max_kg: 0, step_kg: 0 };

export type SessionSummary =
  | {
      kind: "load";
      exerciseName: string;
      oldE1rm: number | null;
      newE1rm: number;
      e1rmUpdated: boolean;
      suggestion: LoadSuggestion | null;
    }
  | {
      kind: "nonload";
      exerciseName: string;
      unit: string;
      target: number;
      isPR: boolean;
    };

export function SesionView({
  session,
  userId,
  onFinish,
}: {
  session: LocalSession;
  userId: string;
  onFinish: (summary: SessionSummary[]) => void;
}) {
  const [finishing, setFinishing] = useState(false);
  const [voiceMatches, setVoiceMatches] = useState<Record<string, VoicePrefill>>({});

  const slots = useLiveQuery(
    async () => {
      if (!session.day_template_id) return [];
      const rows = await db.template_slots.where("day_template_id").equals(session.day_template_id).toArray();
      return rows.sort((a, b) => a.slot_order - b.slot_order);
    },
    [session.day_template_id],
    []
  );

  const voiceContext = useLiveQuery(
    async () => {
      const exerciseIds = Array.from(new Set((slots ?? []).map((s) => s.exercise_id)));
      const exercises = (await db.exercises.bulkGet(exerciseIds)).filter((e): e is NonNullable<typeof e> => !!e);
      const equipmentIds = Array.from(new Set(exercises.map((e) => e.equipment_id).filter((id): id is string => !!id)));
      const equipmentRows = (await db.equipment.bulkGet(equipmentIds)).filter((e): e is NonNullable<typeof e> => !!e);
      const equipmentById = new Map(equipmentRows.map((e) => [e.id, e]));

      const byName = new Map<string, string>();
      const entries: VoiceContextExercise[] = exercises.map((exercise) => {
        byName.set(exercise.name, exercise.id);
        const equipment = exercise.equipment_id ? equipmentById.get(exercise.equipment_id) : undefined;
        return {
          name: exercise.name,
          unit: exercise.unit as VoiceContextExercise["unit"],
          loadOptions: exercise.unit === "kg" ? resolveAvailableLoads((equipment as EquipmentLoadConfig | undefined) ?? NO_EQUIPMENT) : undefined,
        };
      });
      return { entries, byName };
    },
    [slots],
    { entries: [] as VoiceContextExercise[], byName: new Map<string, string>() }
  );

  function handleVoiceParsed(sets: VoiceParsedSet[]) {
    setVoiceMatches((prev) => {
      const next = { ...prev };
      const ts = Date.now();
      for (const set of sets) {
        const exerciseId = voiceContext.byName.get(set.exercise);
        if (!exerciseId) continue;
        next[exerciseId] = { load: set.load_kg, reps: set.reps, rpe: set.rpe, ts };
      }
      return next;
    });
  }

  async function handleFinish() {
    setFinishing(true);
    try {
      const allLogs = await db.set_logs.where("session_id").equals(session.id).toArray();
      const exerciseIds = Array.from(new Set(allLogs.map((l) => l.exercise_id)));
      const now = nowIso();
      const summary: SessionSummary[] = [];

      for (const exerciseId of exerciseIds) {
        const exercise = await db.exercises.get(exerciseId);
        if (!exercise) continue;
        const logsForExercise = allLogs.filter((l) => l.exercise_id === exerciseId && l._deleted !== 1);
        const slot = (slots ?? []).find((s) => s.exercise_id === exerciseId);

        if (exercise.unit === "kg") {
          const sets = logsForExercise
            .filter((l) => l.actual_load_kg != null && l.actual_reps != null && l.rpe_reported != null)
            .map((l) => ({ load: l.actual_load_kg!, reps: l.actual_reps!, rpe: l.rpe_reported! }));
          if (sets.length === 0) continue;

          const oldE1rm = exercise.e1rm_kg;
          const { e1rm, updated } = updateE1rm(exercise, sets);

          if (updated) {
            await db.exercises.update(exerciseId, { e1rm_kg: e1rm, updated_at: now, _dirty: 1 });
            await db.e1rm_estimates.put({
              id: newId(),
              user_id: userId,
              created_at: now,
              updated_at: now,
              exercise_id: exerciseId,
              date: todayIso(),
              e1rm_kg: e1rm,
              method: "epley_rpe",
              source_session_id: session.id,
              _dirty: 1,
              _deleted: 0,
            });
          }

          let suggestion: LoadSuggestion | null = null;
          if (slot?.reps != null && slot?.rpe_target != null) {
            const equipment = exercise.equipment_id ? await db.equipment.get(exercise.equipment_id) : undefined;
            suggestion = suggestNextLoad(
              { target_reps: slot.reps, target_rpe: slot.rpe_target, last_session_sets: sets, readiness: session.readiness },
              (equipment as EquipmentLoadConfig | undefined) ?? NO_EQUIPMENT
            );
          }

          summary.push({
            kind: "load",
            exerciseName: exercise.name,
            oldE1rm,
            newE1rm: e1rm,
            e1rmUpdated: updated,
            suggestion,
          });
        } else {
          const history = (await db.set_logs.where("exercise_id").equals(exerciseId).toArray())
            .filter((l) => l._deleted !== 1 && l.actual_reps != null)
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((l) => l.actual_reps!);
          const { target, isPR } = suggestNextTarget(history);
          summary.push({ kind: "nonload", exerciseName: exercise.name, unit: exercise.unit, target, isPR });
        }
      }

      onFinish(summary);
    } finally {
      setFinishing(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Sesión de hoy</h1>
        <SyncStatus />
      </div>

      {voiceContext.entries.length > 0 && (
        <VoiceCapture contexto={voiceContext.entries} onParsed={handleVoiceParsed} />
      )}

      {(slots ?? []).map((slot) => (
        <SlotCard
          key={slot.id}
          slot={slot}
          sessionId={session.id}
          userId={userId}
          voicePrefill={voiceMatches[slot.exercise_id]}
        />
      ))}

      {slots && slots.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Esta plantilla no tiene ejercicios.</p>
      )}

      <button
        onClick={handleFinish}
        disabled={finishing}
        className="rounded-lg bg-zinc-900 px-4 py-3 text-center font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {finishing ? "Cerrando…" : "Finalizar sesión"}
      </button>
    </div>
  );
}
