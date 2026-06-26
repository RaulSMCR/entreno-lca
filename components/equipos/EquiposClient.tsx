"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { EquipmentForm, type EquipmentFormValues } from "./EquipmentForm";

type EquipmentRow = Database["public"]["Tables"]["equipment"]["Row"];

const typeLabel: Record<string, string> = {
  free_weight: "Peso libre",
  machine: "Máquina",
  cable_stack: "Polea",
  bodyweight: "Peso corporal",
  barbell: "Barra",
};

const loadModeLabel: Record<string, string> = {
  list: "Lista",
  range: "Rango",
  barbell: "Barra + discos",
};

export function EquiposClient({ initialEquipment }: { initialEquipment: EquipmentRow[] }) {
  const [items, setItems] = useState(initialEquipment);
  const [editing, setEditing] = useState<EquipmentRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const supabase = createClient();
    const { data } = await supabase.from("equipment").select("*").order("name");
    setItems(data ?? []);
  }

  async function handleSave(values: EquipmentFormValues) {
    setError(null);
    const supabase = createClient();

    const { error: saveError } = editing
      ? await supabase.from("equipment").update(values).eq("id", editing.id)
      : await supabase.from("equipment").insert(values);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    setShowForm(false);
    setEditing(null);
    await refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Borrar este equipo?")) return;
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("equipment").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Equipos</h1>
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

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {showForm && (
        <EquipmentForm
          initial={editing}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}

      <ul className="flex flex-col gap-2">
        {items.map((eq) => (
          <li
            key={eq.id}
            className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{eq.name}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {typeLabel[eq.type] ?? eq.type} · {loadModeLabel[eq.load_mode] ?? eq.load_mode}
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              <button
                onClick={() => {
                  setEditing(eq);
                  setShowForm(true);
                }}
              >
                Editar
              </button>
              <button onClick={() => handleDelete(eq.id)} className="text-red-600 dark:text-red-400">
                Borrar
              </button>
            </div>
          </li>
        ))}
        {items.length === 0 && !showForm && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Todavía no agregaste equipos.</p>
        )}
      </ul>
    </div>
  );
}
