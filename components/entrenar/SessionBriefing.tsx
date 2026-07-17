"use client";

import { useEffect, useState } from "react";
import { SyncStatus } from "@/components/SyncStatus";
import type { LocalDayTemplate } from "@/lib/db";
import type { SessionTimeEstimate, SlotWithExercise } from "@/lib/session-time";
import type { RecommendedAction, SkipPattern } from "@/lib/skip-patterns";
import { getObjectiveFromSlot, type TrainingObjective } from "@/lib/training-theory";
import { AlternativeExercisePanel } from "./AlternativeExercisePanel";

const OBJECTIVE_LABEL: Record<TrainingObjective, string> = {
  strength: "Fuerza",
  power: "Potencia",
  hypertrophy: "Hipertrofia",
  endurance: "Resistencia",
};

const OBJECTIVE_COLOR: Record<TrainingObjective, string> = {
  strength: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
  power: "border-purple-300 bg-purple-50 text-purple-900 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-100",
  hypertrophy: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100",
  endurance:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
};

const EQUIPMENT_ICON: Record<string, string> = {
  barbell: "🏋️",
  free_weight: "💪",
  machine: "⚙️",
  cable_stack: "🔗",
  bodyweight: "🤸",
};

function schemeLabel(slot: SlotWithExercise): string {
  const sets = slot.sets ?? "?";
  if (slot.exercise.unit !== "kg") {
    return slot.reps_or_time ? `${sets}× ${slot.reps_or_time}` : `${sets} series`;
  }
  const parts = [`${sets}×${slot.reps ?? "?"}`];
  if (slot.pct_max != null) parts.push(`${slot.pct_max}%`);
  if (slot.rpe_target != null) parts.push(`RPE ${slot.rpe_target}`);
  return parts.join(" · ");
}

export function SessionBriefing({
  templates,
  selectedTemplateId,
  onTemplateChange,
  templateTitle,
  templateFocus,
  slots,
  estimate,
  patterns,
  readiness,
  onReadinessChange,
  onMoveToStart,
  onStart,
}: {
  templates: LocalDayTemplate[];
  selectedTemplateId: string;
  onTemplateChange: (id: string) => void;
  templateTitle: string | null;
  templateFocus: string | null;
  slots: SlotWithExercise[];
  estimate: SessionTimeEstimate | null;
  patterns: SkipPattern[];
  readiness: number | null;
  onReadinessChange: (r: number | null) => void;
  /** R-4: "Mover al inicio de la sesión" — el padre decide el orden real. Por
   *  slotId, no exerciseId: el mismo ejercicio puede repetirse en más de un
   *  slot con propósitos distintos (fuerza vs volumen). */
  onMoveToStart: (slotId: string) => void;
  onStart: () => void;
}) {
  const criticalPatterns = patterns.filter((p) => p.severity === "critical");
  const otherPatterns = patterns.filter((p) => p.severity !== "critical");

  const [toast, setToast] = useState<string | null>(null);
  const [alternativesFor, setAlternativesFor] = useState<SkipPattern | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function handlePatternAction(pattern: SkipPattern, action: RecommendedAction) {
    if (action.actionType === "reorder_in_session") {
      onMoveToStart(pattern.slotId);
      setToast(`✅ ${pattern.exerciseName} se hará primero hoy`);
    } else if (action.actionType === "suggest_alternative") {
      setAlternativesFor(pattern);
    }
  }

  const alternativeCandidates = alternativesFor
    ? (() => {
        const patternSlot = slots.find((s) => s.id === alternativesFor.slotId);
        if (!patternSlot) return [];
        const seen = new Set<string>([alternativesFor.exerciseId]);
        return slots
          .filter((s) => s.block === patternSlot.block && !seen.has(s.exercise_id) && seen.add(s.exercise_id))
          .map((s) => ({ id: s.exercise_id, name: s.exercise.name }));
      })()
    : [];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{templateTitle ?? "Hoy"}</h1>
          {templateFocus && <p className="text-sm text-zinc-500 dark:text-zinc-400">{templateFocus}</p>}
        </div>
        <SyncStatus />
      </div>

      {toast && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
          {toast}
        </div>
      )}

      {criticalPatterns.map((p) => (
        <CriticalPatternBanner key={`${p.exerciseId}-${p.type}`} pattern={p} onAction={handlePatternAction} />
      ))}

      {otherPatterns.length > 0 && (
        <CollapsiblePatternBanner patterns={otherPatterns} onAction={handlePatternAction} />
      )}

      {estimate && slots.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
            ~{estimate.estimatedMinutes} <span className="text-lg font-normal text-zinc-500 dark:text-zinc-400">min</span>
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{estimate.breakdown}</p>
        </div>
      )}

      {slots.length > 0 && (
        <div className="flex flex-col gap-2">
          {slots.map((slot) => {
            const objective = getObjectiveFromSlot(slot, slot.exercise.unit);
            const exerciseEstimate = estimate?.exercises.find((e) => e.slotId === slot.id);
            const equipmentType = slot.exercise.equipment?.type;
            return (
              <div
                key={slot.id}
                className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">{slot.exercise.name}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{schemeLabel(slot)}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${OBJECTIVE_COLOR[objective]}`}>
                      {OBJECTIVE_LABEL[objective]}
                    </span>
                    {equipmentType && (
                      <span className="text-sm" title={equipmentType}>
                        {EQUIPMENT_ICON[equipmentType] ?? "🔩"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right text-sm text-zinc-500 dark:text-zinc-400">
                  {exerciseEstimate && <p>~{Math.round(exerciseEstimate.totalSeconds / 60)} min</p>}
                  <p>Pendiente</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {slots.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-zinc-500 dark:text-zinc-400">Hoy es descanso (o no hay plantilla asignada).</p>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <label className="flex flex-col gap-1 text-sm">
          Elegir otra plantilla
          <select
            value={selectedTemplateId}
            onChange={(e) => onTemplateChange(e.target.value)}
            className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Descanso / sin plantilla</option>
            {templates.map((t) => (
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
              onClick={() => onReadinessChange(readiness === r ? null : r)}
              aria-pressed={readiness === r ? "true" : "false"}
              className={`h-11 flex-1 rounded-lg border text-base font-medium ${
                readiness === r
                  ? "border-brand-600 bg-brand-600 text-white"
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
        onClick={onStart}
        className="rounded-lg bg-accent-600 px-4 py-3 text-center font-medium text-brand-950"
      >
        ▶ Iniciar sesión
      </button>

      {alternativesFor && (
        <AlternativeExercisePanel
          exerciseName={alternativesFor.exerciseName}
          candidates={alternativeCandidates}
          onClose={() => setAlternativesFor(null)}
        />
      )}
    </div>
  );
}

// reorder_in_session y suggest_alternative son interactivos (ver
// handlePatternAction); el resto (adjust_load, consult_professional,
// change_schedule) queda como referencia informativa — adjust_load ya se
// aplica solo al cerrar la sesión (lib/engine.ts), y las otras dos no tienen
// una acción concreta que ejecutar desde acá.
function CriticalPatternBanner({
  pattern,
  onAction,
}: {
  pattern: SkipPattern;
  onAction: (pattern: SkipPattern, action: RecommendedAction) => void;
}) {
  return (
    <div className="rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
      <p className="font-medium text-red-900 dark:text-red-100">⚠️ Revisá esto antes de comenzar</p>
      <p className="mt-1 text-sm text-red-900 dark:text-red-100">{pattern.recommendation.body}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {pattern.recommendation.actions.map((a) => (
          <PatternActionChip key={a.label} action={a} tone="red" onClick={() => onAction(pattern, a)} />
        ))}
      </div>
    </div>
  );
}

function CollapsiblePatternBanner({
  patterns,
  onAction,
}: {
  patterns: SkipPattern[];
  onAction: (pattern: SkipPattern, action: RecommendedAction) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between px-4 py-2 text-left text-sm font-medium text-amber-900 dark:text-amber-100"
      >
        <span>
          💡 {patterns.length} sugerencia{patterns.length > 1 ? "s" : ""} para optimizar tu sesión de hoy
        </span>
        <span>{open ? "▾ Ocultar" : "▸ Ver"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-4 pb-4">
          {patterns.map((p) => (
            <div key={`${p.exerciseId}-${p.type}`}>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{p.recommendation.title}</p>
              <p className="text-sm text-amber-900 dark:text-amber-100">{p.recommendation.body}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {p.recommendation.actions.map((a) => (
                  <PatternActionChip key={a.label} action={a} tone="amber" onClick={() => onAction(p, a)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const INTERACTIVE_ACTION_TYPES = new Set(["reorder_in_session", "suggest_alternative"]);

function PatternActionChip({
  action,
  tone,
  onClick,
}: {
  action: RecommendedAction;
  tone: "red" | "amber";
  onClick: () => void;
}) {
  const interactive = INTERACTIVE_ACTION_TYPES.has(action.actionType);
  const toneClass =
    tone === "red"
      ? "border-red-300 text-red-900 dark:border-red-700 dark:text-red-100"
      : "border-amber-300 text-amber-900 dark:border-amber-700 dark:text-amber-100";

  if (!interactive) {
    return <span className={`rounded-lg border px-2 py-1 text-xs ${toneClass}`}>{action.label}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 rounded-lg border px-2 py-1 text-xs font-medium ${toneClass}`}
    >
      {action.label}
    </button>
  );
}
