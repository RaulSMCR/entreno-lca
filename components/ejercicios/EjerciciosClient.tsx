"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { ExerciseForm, type ExerciseFormValues } from "./ExerciseForm";

type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];

const unitLabel: Record<string, string> = {
  kg: "kg",
  seconds: "segundos",
  meters: "metros",
  intervals: "intervalos",
  reps: "reps",
};

export function EjerciciosClient({
  initialExercises,
  equipment,
}: {
  initialExercises: ExerciseRow[];
  equipment: { id: string; name: string }[];
}) {
  const [items, setItems] = useState(initialExercises);
  const [editing, setEditing] = useState<ExerciseRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const equipmentById = new Map(equipment.map((e) => [e.id, e.name]));

  async function refresh() {
    const supabase = createClient();
    const { data } = await supabase.from("exercises").select("*").order("name");
    setItems(data ?? []);
  }

  async function handleSave(values: ExerciseFormValues) {
    setError(null);
    const supabase = createClient();

    const { error: saveError } = editing
      ? await supabase.from("exercises").update(values).eq("id", editing.id)
      : await supabase.from("exercises").insert(values);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    setShowForm(false);
    setEditing(null);
    await refresh();
  }

  async function toggleActive(ex: ExerciseRow) {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("exercises")
      .update({ is_active: !ex.is_active })
      .eq("id", ex.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await refresh();
  }

  const visible = items.filter((ex) => (showArchived ? true : ex.is_active));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Ejercicios</h1>
        {!showForm && (
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            + Nuevo
          </button>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Mostrar archivados
      </label>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {showForm && (
        <ExerciseForm
          initial={editing}
          equipment={equipment}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}

      <ul className="flex flex-col gap-2">
        {visible.map((ex) => (
          <li
            key={ex.id}
            className={`flex items-center justify-between rounded-xl border border-zinc-200 p-3 dark:border-zinc-800 ${
              ex.is_active ? "" : "opacity-50"
            }`}
          >
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{ex.name}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {ex.block} · {unitLabel[ex.unit] ?? ex.unit}
                {ex.equipment_id && ` · ${equipmentById.get(ex.equipment_id) ?? "?"}`}
                {ex.e1rm_kg != null && ` · e1RM ${ex.e1rm_kg}kg`}
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              <button
                onClick={() => {
                  setEditing(ex);
                  setShowForm(true);
                }}
              >
                Editar
              </button>
              <button onClick={() => toggleActive(ex)} className="text-zinc-500 dark:text-zinc-400">
                {ex.is_active ? "Archivar" : "Reactivar"}
              </button>
            </div>
          </li>
        ))}
        {visible.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No hay ejercicios para mostrar.</p>
        )}
      </ul>
    </div>
  );
}
