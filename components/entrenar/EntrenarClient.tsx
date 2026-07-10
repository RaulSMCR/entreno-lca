"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, newId, nowIso, type LocalSession } from "@/lib/db";
import { syncAll } from "@/lib/sync";
import { todayIso, todayWeekday } from "@/lib/date";
import { SessionBriefing } from "./SessionBriefing";
import { WorkoutSetFlow, type WorkoutFinishResult } from "./WorkoutSetFlow";
import { ResumenView } from "./ResumenView";
import { estimateSessionTime, type SlotWithExercise } from "@/lib/session-time";
import { analyzeSessionPatterns, type SkipPattern } from "@/lib/skip-patterns";
import { initSessionExerciseStatuses } from "@/lib/session-exercise";

type View = "loading" | "hoy" | "sesion" | "resumen";

export function EntrenarClient({ userId }: { userId: string }) {
  const [view, setView] = useState<View>("loading");
  const [session, setSession] = useState<LocalSession | null>(null);
  const [result, setResult] = useState<WorkoutFinishResult | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [readiness, setReadiness] = useState<number | null>(null);
  const [patterns, setPatterns] = useState<SkipPattern[]>([]);

  const templates = useLiveQuery(() => db.day_templates.orderBy("code").toArray(), [], []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await syncAll();
      } catch {
        // sin red o falló: seguimos con lo que haya en caché local
      }
      if (cancelled) return;

      const weekday = todayWeekday();
      const date = todayIso();

      const [weeklyEntry, existing] = await Promise.all([
        db.weekly_schedule.where("weekday").equals(weekday).first(),
        db.sessions.where("date").equals(date).first(),
      ]);

      if (cancelled) return;

      if (existing && existing._deleted !== 1) {
        setSession(existing);
        setView("sesion");
      } else {
        setSelectedTemplateId(weeklyEntry?.day_template_id ?? "");
        setView("hoy");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId);

  const slotsWithExercise = useLiveQuery(
    async () => {
      if (!selectedTemplateId) return [];
      const rows = (await db.template_slots.where("day_template_id").equals(selectedTemplateId).toArray()).sort(
        (a, b) => a.slot_order - b.slot_order
      );
      const exerciseIds = Array.from(new Set(rows.map((s) => s.exercise_id)));
      const exercises = (await db.exercises.bulkGet(exerciseIds)).filter((e): e is NonNullable<typeof e> => !!e);
      const equipmentIds = Array.from(new Set(exercises.map((e) => e.equipment_id).filter((id): id is string => !!id)));
      const equipmentRows = (await db.equipment.bulkGet(equipmentIds)).filter((e): e is NonNullable<typeof e> => !!e);
      const equipmentById = new Map(equipmentRows.map((e) => [e.id, e]));
      const exerciseById = new Map(exercises.map((e) => [e.id, e]));

      return rows
        .map((slot) => {
          const exercise = exerciseById.get(slot.exercise_id);
          if (!exercise) return null;
          const equipment = exercise.equipment_id ? equipmentById.get(exercise.equipment_id) : undefined;
          return { ...slot, exercise: { ...exercise, equipment } };
        })
        .filter((s): s is SlotWithExercise => s != null);
    },
    [selectedTemplateId],
    [] as SlotWithExercise[]
  );

  const estimate = useMemo(
    () => (slotsWithExercise.length > 0 ? estimateSessionTime(slotsWithExercise) : null),
    [slotsWithExercise]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (slotsWithExercise.length === 0) {
        setPatterns([]);
        return;
      }
      const detected = await analyzeSessionPatterns(
        slotsWithExercise.map((s) => ({ exercise_id: s.exercise_id, block: s.block })),
        slotsWithExercise.map((s) => ({
          id: s.exercise_id,
          name: s.exercise.name,
          equipment: s.exercise.equipment ? { name: s.exercise.equipment.name } : null,
        }))
      );
      if (!cancelled) setPatterns(detected);
    })();
    return () => {
      cancelled = true;
    };
  }, [slotsWithExercise]);

  async function startSession(templateId: string | null) {
    const now = nowIso();
    const newSession: LocalSession = {
      id: newId(),
      user_id: userId,
      created_at: now,
      updated_at: now,
      date: todayIso(),
      day_template_id: templateId,
      bodyweight_kg: null,
      readiness,
      notes: null,
      session_duration_variance_pct: null,
      _dirty: 1,
      _deleted: 0,
    };
    await db.sessions.put(newSession);

    if (templateId && slotsWithExercise.length > 0) {
      await initSessionExerciseStatuses({
        sessionId: newSession.id,
        userId,
        slots: slotsWithExercise.map((s) => ({ id: s.id, exercise_id: s.exercise_id, sets: s.sets })),
      });
    }

    setSession(newSession);
    setView("sesion");
  }

  function handleFinish(finishedResult: WorkoutFinishResult) {
    setResult(finishedResult);
    setView("resumen");
    syncAll().catch(() => {});
  }

  if (view === "loading") {
    return <div className="p-6 text-sm text-zinc-500 dark:text-zinc-400">Cargando…</div>;
  }

  if (view === "sesion" && session) {
    return <WorkoutSetFlow session={session} userId={userId} onFinish={handleFinish} />;
  }

  if (view === "resumen") {
    return (
      <ResumenView
        summary={result?.summary ?? []}
        sessionId={session?.id ?? null}
        sessionDate={session?.date ?? todayIso()}
        omitted={result?.omitted}
        volumeCompletion={
          result?.volumeCompletion
            ? {
                completedSets: result.volumeCompletion.completedSets,
                plannedSets: result.volumeCompletion.plannedSets,
                pct: result.volumeCompletion.pct,
              }
            : undefined
        }
        onClose={() => {
          setSession(null);
          setResult(null);
          setView("hoy");
        }}
      />
    );
  }

  return (
    <SessionBriefing
      templates={templates ?? []}
      selectedTemplateId={selectedTemplateId}
      onTemplateChange={setSelectedTemplateId}
      templateTitle={selectedTemplate ? `${selectedTemplate.code} — ${selectedTemplate.title}` : null}
      templateFocus={selectedTemplate?.focus ?? null}
      slots={slotsWithExercise}
      estimate={estimate}
      patterns={patterns}
      readiness={readiness}
      onReadinessChange={setReadiness}
      onStart={() => startSession(selectedTemplateId || null)}
    />
  );
}
