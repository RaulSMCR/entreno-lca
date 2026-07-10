"use client";

import { useState } from "react";
import type { ExerciseStatus } from "@/lib/session-exercise";

export type NavigatorExercise = {
  exerciseId: string;
  exerciseName: string;
  scheme: string;
  estimatedMinutes: number;
  status: ExerciseStatus;
  block: string;
  originalOrder: number;
};

const STATUS_ICON: Record<ExerciseStatus, string> = {
  completed: "✅",
  partial: "◐",
  in_progress: "▶️",
  skipped: "⏭️",
  pending: "⚪",
};

const STATUS_LABEL: Record<ExerciseStatus, string> = {
  completed: "Completado",
  partial: "Parcial",
  in_progress: "En curso",
  skipped: "Omitido",
  pending: "Pendiente",
};

// Detecta pares de ejercicios pensados como superserie: mismo bloque y
// slot_order consecutivo en el orden original del template.
function findLinkedPartner(exercise: NavigatorExercise, all: NavigatorExercise[]): NavigatorExercise | null {
  return (
    all.find(
      (other) =>
        other.exerciseId !== exercise.exerciseId &&
        other.block === exercise.block &&
        Math.abs(other.originalOrder - exercise.originalOrder) === 1
    ) ?? null
  );
}

export function SessionNavigator({
  exercises,
  activeExerciseId,
  executionOrder,
  remainingMinutes,
  onNavigate,
  onRequestSkip,
  onReorder,
  onFinishSession,
}: {
  exercises: NavigatorExercise[];
  activeExerciseId: string | null;
  executionOrder: string[];
  remainingMinutes: number;
  onNavigate: (exerciseId: string) => void;
  onRequestSkip: (exerciseId: string) => void;
  onReorder: (newPendingOrder: string[]) => void;
  onFinishSession: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [orderMode, setOrderMode] = useState<"recommended" | "free">("recommended");
  const [showCompleted, setShowCompleted] = useState(false);

  const byId = new Map(exercises.map((e) => [e.exerciseId, e]));
  const total = exercises.length;
  const activeIndex = activeExerciseId
    ? executionOrder.findIndex((id) => id === activeExerciseId)
    : -1;

  const completedOrSkipped = exercises.filter((e) => e.status === "completed" || e.status === "skipped");
  const inProgressOrPartial = exercises.filter((e) => e.status === "in_progress" || e.status === "partial");
  const pending = exercises.filter((e) => e.status === "pending");

  const completedCount = exercises.filter((e) => e.status === "completed").length;
  const inProgressCount = exercises.filter((e) => e.status === "in_progress" || e.status === "partial").length;
  const pendingCount = pending.length;

  const pendingOrder =
    orderMode === "recommended"
      ? [...pending].sort((a, b) => a.originalOrder - b.originalOrder).map((e) => e.exerciseId)
      : executionOrder.filter((id) => pending.some((p) => p.exerciseId === id));

  function move(index: number, direction: -1 | 1) {
    const next = [...pendingOrder];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrderMode("free");
    onReorder(next);
  }

  const isCustomOrder = pendingOrder.some((id, i) => {
    const sorted = [...pending].sort((a, b) => a.originalOrder - b.originalOrder);
    return sorted[i]?.exerciseId !== id;
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir navegador de ejercicios"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg dark:bg-zinc-50 dark:text-zinc-900"
      >
        <span className="text-xl">☰</span>
        {total > 0 && (
          <span className="absolute -top-1 -right-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-xs font-semibold text-white">
            {Math.max(activeIndex + 1, 1)}/{total}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:justify-end">
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 md:mr-4 md:max-h-[90vh] md:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
              <div>
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Ejercicios de hoy</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {completedCount} completados · {inProgressCount} en curso · {pendingCount} pendientes
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">~{remainingMinutes} min restantes</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar navegador"
                className="min-h-11 min-w-11 rounded-lg text-xl text-zinc-500 dark:text-zinc-400"
              >
                ✕
              </button>
            </div>

            <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-900">
              <div
                className="h-1.5 bg-emerald-500"
                style={{ width: total === 0 ? "0%" : `${((completedCount + exercises.filter((e) => e.status === "skipped").length) / total) * 100}%` }}
              />
            </div>

            <div className="flex gap-2 p-3">
              <button
                type="button"
                onClick={() => setOrderMode("recommended")}
                className={`min-h-11 flex-1 rounded-lg border px-3 text-sm ${
                  orderMode === "recommended"
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                📋 Orden recomendado
              </button>
              <button
                type="button"
                onClick={() => setOrderMode("free")}
                className={`min-h-11 flex-1 rounded-lg border px-3 text-sm ${
                  orderMode === "free"
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                🧩 Orden libre
              </button>
            </div>

            {isCustomOrder && (
              <p className="px-3 pb-2 text-xs">
                <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                  ⚡ Orden personalizado
                </span>
              </p>
            )}

            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {inProgressOrPartial.map((exercise) => (
                <NavigatorRow
                  key={exercise.exerciseId}
                  exercise={exercise}
                  isActive={exercise.exerciseId === activeExerciseId}
                  onNavigate={() => {
                    onNavigate(exercise.exerciseId);
                    setOpen(false);
                  }}
                  onSkip={() => onRequestSkip(exercise.exerciseId)}
                />
              ))}

              {pendingOrder.map((id, index) => {
                const exercise = byId.get(id);
                if (!exercise) return null;
                const partner = findLinkedPartner(exercise, exercises);
                const partnerStillAdjacent =
                  !partner ||
                  partner.status !== "pending" ||
                  pendingOrder[index - 1] === partner.exerciseId ||
                  pendingOrder[index + 1] === partner.exerciseId;

                return (
                  <div key={id}>
                    <NavigatorRow
                      exercise={exercise}
                      isActive={false}
                      onNavigate={() => {
                        onNavigate(id);
                        setOpen(false);
                      }}
                      onSkip={() => onRequestSkip(id)}
                      reorderControls={
                        orderMode === "free"
                          ? {
                              onMoveUp: () => move(index, -1),
                              onMoveDown: () => move(index, 1),
                              disableUp: index === 0,
                              disableDown: index === pendingOrder.length - 1,
                            }
                          : undefined
                      }
                    />
                    {!partnerStillAdjacent && partner && (
                      <p className="mb-1 px-2 text-xs text-amber-700 dark:text-amber-400">
                        ⚠️ Este ejercicio está pensado para hacerse junto con {partner.exerciseName}
                      </p>
                    )}
                  </div>
                );
              })}

              {completedOrSkipped.length > 0 && (
                <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowCompleted((v) => !v)}
                    className="min-h-11 w-full text-left text-sm text-zinc-500 dark:text-zinc-400"
                  >
                    {showCompleted ? "▾" : "▸"} Ver ejercicios completados ({completedOrSkipped.length})
                  </button>
                  {showCompleted &&
                    completedOrSkipped.map((exercise) => (
                      <NavigatorRow key={exercise.exerciseId} exercise={exercise} isActive={false} readonly />
                    ))}
                </div>
              )}
            </div>

            <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
              {pendingCount > 0 && (
                <p className="mb-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  {pendingCount} ejercicios pendientes
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  if (pendingCount === 0 || confirm(`Quedan ${pendingCount} ejercicios pendientes. ¿Finalizar sesión igual?`)) {
                    onFinishSession();
                  }
                }}
                className="min-h-11 w-full rounded-lg bg-zinc-900 px-4 py-3 text-center font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
              >
                Finalizar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NavigatorRow({
  exercise,
  isActive,
  onNavigate,
  onSkip,
  reorderControls,
  readonly,
}: {
  exercise: NavigatorExercise;
  isActive: boolean;
  onNavigate?: () => void;
  onSkip?: () => void;
  reorderControls?: { onMoveUp: () => void; onMoveDown: () => void; disableUp: boolean; disableDown: boolean };
  readonly?: boolean;
}) {
  return (
    <div
      className={`mb-2 flex items-center gap-2 rounded-lg border p-2 ${
        isActive
          ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <span aria-label={STATUS_LABEL[exercise.status]} title={STATUS_LABEL[exercise.status]}>
        {STATUS_ICON[exercise.status]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">{exercise.exerciseName}</p>
        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
          {exercise.scheme} · ~{exercise.estimatedMinutes} min
        </p>
      </div>
      {reorderControls && (
        <div className="flex flex-col">
          <button
            type="button"
            aria-label="Mover arriba"
            disabled={reorderControls.disableUp}
            onClick={reorderControls.onMoveUp}
            className="min-h-9 min-w-9 text-sm disabled:opacity-30"
          >
            ▲
          </button>
          <button
            type="button"
            aria-label="Mover abajo"
            disabled={reorderControls.disableDown}
            onClick={reorderControls.onMoveDown}
            className="min-h-9 min-w-9 text-sm disabled:opacity-30"
          >
            ▼
          </button>
        </div>
      )}
      {!readonly && onNavigate && (
        <button
          type="button"
          onClick={onNavigate}
          className="min-h-11 rounded-lg border border-zinc-300 px-2 text-sm dark:border-zinc-700"
        >
          Ir ▶
        </button>
      )}
      {!readonly && onSkip && exercise.status !== "completed" && (
        <button
          type="button"
          onClick={onSkip}
          className="min-h-11 rounded-lg border border-zinc-300 px-2 text-sm dark:border-zinc-700"
        >
          ⏭
        </button>
      )}
    </div>
  );
}
