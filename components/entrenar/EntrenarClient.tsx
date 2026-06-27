"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, newId, nowIso, type LocalSession } from "@/lib/db";
import { syncAll } from "@/lib/sync";
import { todayIso, todayWeekday } from "@/lib/date";
import { SyncStatus } from "@/components/SyncStatus";
import { SesionView, type SessionSummary } from "./SesionView";
import { ResumenView } from "./ResumenView";

type View = "loading" | "hoy" | "sesion" | "resumen";

export function EntrenarClient({ userId }: { userId: string }) {
  const [view, setView] = useState<View>("loading");
  const [session, setSession] = useState<LocalSession | null>(null);
  const [summary, setSummary] = useState<SessionSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [readiness, setReadiness] = useState<number | null>(null);

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
      _dirty: 1,
      _deleted: 0,
    };
    await db.sessions.put(newSession);
    setSession(newSession);
    setView("sesion");
  }

  function handleFinish(finishedSummary: SessionSummary[]) {
    setSummary(finishedSummary);
    setView("resumen");
    syncAll().catch(() => {});
  }

  if (view === "loading") {
    return <div className="p-6 text-sm text-zinc-500 dark:text-zinc-400">Cargando…</div>;
  }

  if (view === "sesion" && session) {
    return <SesionView session={session} userId={userId} onFinish={handleFinish} />;
  }

  if (view === "resumen") {
    return (
      <ResumenView
        summary={summary}
        sessionId={session?.id ?? null}
        sessionDate={session?.date ?? todayIso()}
        onClose={() => {
          setSession(null);
          setView("hoy");
        }}
      />
    );
  }

  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Hoy</h1>
        <SyncStatus />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {selectedTemplate ? (
          <>
            <p className="font-medium text-zinc-900 dark:text-zinc-50">{selectedTemplate.title}</p>
            {selectedTemplate.focus && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{selectedTemplate.focus}</p>
            )}
          </>
        ) : (
          <p className="text-zinc-500 dark:text-zinc-400">Hoy es descanso (o no hay plantilla asignada).</p>
        )}

        <label className="mt-3 flex flex-col gap-1 text-sm">
          Elegir otra plantilla
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Descanso / sin plantilla</option>
            {(templates ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="font-medium text-zinc-900 dark:text-zinc-50">¿Cómo llegás hoy?</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Readiness 1 (golpeado) a 5 (a full). Opcional.</p>
        <div className="mt-2 flex gap-2">
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReadiness(readiness === r ? null : r)}
              aria-pressed={readiness === r ? "true" : "false"}
              className={`h-11 flex-1 rounded-lg border text-base font-medium ${
                readiness === r
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                  : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => startSession(selectedTemplateId || null)}
        className="rounded-lg bg-zinc-900 px-4 py-3 text-center font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
      >
        Empezar sesión
      </button>
    </div>
  );
}
