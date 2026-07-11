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
import { ensureRestDayTemplate } from "@/lib/rest-day";

type View = "loading" | "hoy" | "sesion" | "resumen";

export function EntrenarClient({ userId }: { userId: string }) {
  const [view, setView] = useState<View>("loading");
  const [session, setSession] = useState<LocalSession | null>(null);
  const [result, setResult] = useState<WorkoutFinishResult | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [readiness, setReadiness] = useState<number | null>(null);
  const [patterns, setPatterns] = useState<SkipPattern[]>([]);
  // R-4: "Mover al inicio de la sesión" — solo afecta esta sesión (no
  // persiste al template_slots real). Por slotId, no exerciseId: el mismo
  // ejercicio puede repetirse en más de un slot con propósitos distintos.
  const [prioritySlotId, setPrioritySlotId] = useState<string | null>(null);

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
        // Día de descanso (sin plantilla asignada): en vez de quedar vacío,
        // se completa con un duplicado de la movilidad del día anterior del
        // ciclo semanal. Seguro de recrear acá porque todavía no hay sesión
        // de hoy que referencie esos template_slots.
        const restTemplateId = !weeklyEntry?.day_template_id
          ? await ensureRestDayTemplate(userId, weekday)
          : null;
        if (cancelled) return;
        setSelectedTemplateId(weeklyEntry?.day_template_id ?? restTemplateId ?? "");
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

  // Si hay un ejercicio priorizado (R-4: "mover al inicio de la sesión"), se
  // adelanta acá para que tanto el estimado como la lista mostrada y el
  // orden inicial de la sesión reflejen el cambio de forma consistente.
  const orderedSlots = useMemo(() => {
    if (!prioritySlotId) return slotsWithExercise;
    const idx = slotsWithExercise.findIndex((s) => s.id === prioritySlotId);
    if (idx <= 0) return slotsWithExercise;
    const copy = [...slotsWithExercise];
    const [moved] = copy.splice(idx, 1);
    return [moved, ...copy];
  }, [slotsWithExercise, prioritySlotId]);

  const estimate = useMemo(
    () => (orderedSlots.length > 0 ? estimateSessionTime(orderedSlots) : null),
    [orderedSlots]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (slotsWithExercise.length === 0) {
        setPatterns([]);
        return;
      }
      const detected = await analyzeSessionPatterns(
        slotsWithExercise.map((s) => ({ id: s.id, exercise_id: s.exercise_id, block: s.block })),
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

    if (templateId && orderedSlots.length > 0) {
      await initSessionExerciseStatuses({
        sessionId: newSession.id,
        userId,
        slots: orderedSlots.map((s) => ({ id: s.id, exercise_id: s.exercise_id, sets: s.sets })),
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
    return (
      <WorkoutSetFlow
        session={session}
        userId={userId}
        prioritySlotId={prioritySlotId}
        onFinish={handleFinish}
      />
    );
  }

  if (view === "resumen") {
    return (
      <ResumenView
        summary={result?.summary ?? []}
        sessionId={session?.id ?? null}
        sessionDate={session?.date ?? todayIso()}
        userId={userId}
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
      onTemplateChange={(id) => {
        setSelectedTemplateId(id);
        setPrioritySlotId(null);
      }}
      templateTitle={selectedTemplate ? `${selectedTemplate.code} — ${selectedTemplate.title}` : null}
      templateFocus={selectedTemplate?.focus ?? null}
      slots={orderedSlots}
      estimate={estimate}
      patterns={patterns}
      readiness={readiness}
      onReadinessChange={setReadiness}
      onMoveToStart={setPrioritySlotId}
      onStart={() => startSession(selectedTemplateId || null)}
    />
  );
}
