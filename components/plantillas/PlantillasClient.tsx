"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { SlotForm, type SlotFormValues } from "./SlotForm";
import { ensureRestDayTemplate } from "@/lib/rest-day";
import { pullRemote, pushPending } from "@/lib/sync";

type TemplateRow = Database["public"]["Tables"]["day_templates"]["Row"];
type SlotRow = Database["public"]["Tables"]["template_slots"]["Row"];
type ExerciseOption = { id: string; name: string; block: string; unit: string; category: string | null };

function slotSummary(slot: SlotRow): string {
  if (slot.block === "principal") {
    const parts = [];
    if (slot.sets != null && slot.reps != null) parts.push(`${slot.sets}×${slot.reps}`);
    if (slot.pct_max != null) parts.push(`${slot.pct_max}%`);
    if (slot.rpe_target != null) parts.push(`RPE ${slot.rpe_target}`);
    if (slot.target_duration_seconds != null) parts.push(`${Math.round(slot.target_duration_seconds / 60)} min`);
    return parts.join(" · ") || "—";
  }
  const parts = [];
  if (slot.reps_or_time) parts.push(slot.reps_or_time);
  if (slot.intensity_note) parts.push(slot.intensity_note);
  if (slot.rpe_target != null) parts.push(`RPE ${slot.rpe_target}`);
  return parts.join(" · ") || "—";
}

export function PlantillasClient({
  userId,
  initialTemplates,
  initialSlots,
  exercises,
}: {
  userId: string;
  initialTemplates: TemplateRow[];
  initialSlots: SlotRow[];
  exercises: ExerciseOption[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [slots, setSlots] = useState(initialSlots);
  const [selectedId, setSelectedId] = useState(initialTemplates[0]?.id ?? null);
  const [editingSlot, setEditingSlot] = useState<SlotRow | "new" | null>(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState({ title: "", focus: "" });
  const [error, setError] = useState<string | null>(null);

  const exercisesById = new Map(exercises.map((e) => [e.id, e.name]));
  const selectedTemplate = templates.find((t) => t.id === selectedId) ?? null;
  const templateSlots = slots
    .filter((s) => s.day_template_id === selectedId)
    .sort((a, b) => a.slot_order - b.slot_order);

  async function refresh() {
    const supabase = createClient();
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.from("day_templates").select("*").order("code"),
      supabase.from("template_slots").select("*").order("slot_order"),
    ]);
    setTemplates(t ?? []);
    setSlots(s ?? []);
  }

  // "DA" (Descanso Activo): esta pantalla lee/escribe Supabase directo, no
  // Dexie — así que además de crear/refrescar la plantilla local-first hay
  // que empujarla y volver a traer para que aparezca acá sin esperar a que
  // el usuario abra /entrenar el día de descanso.
  useEffect(() => {
    (async () => {
      try {
        await pullRemote();
        const created = await ensureRestDayTemplate(userId);
        if (!created) return;
        await pushPending();
        await refresh();
      } catch {
        // sin red o falló: la pantalla sigue mostrando lo que vino del server
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function saveMeta() {
    if (!selectedTemplate) return;
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("day_templates")
      .update({ title: metaDraft.title, focus: metaDraft.focus || null })
      .eq("id", selectedTemplate.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditingMeta(false);
    await refresh();
  }

  async function saveSlot(values: SlotFormValues) {
    if (!selectedTemplate) return;
    setError(null);
    const supabase = createClient();

    if (editingSlot && editingSlot !== "new") {
      const { error: updateError } = await supabase
        .from("template_slots")
        .update(values)
        .eq("id", editingSlot.id);
      if (updateError) {
        setError(updateError.message);
        return;
      }
    } else {
      const nextOrder = templateSlots.length > 0 ? Math.max(...templateSlots.map((s) => s.slot_order)) + 1 : 1;
      const { error: insertError } = await supabase
        .from("template_slots")
        .insert({ ...values, day_template_id: selectedTemplate.id, slot_order: nextOrder });
      if (insertError) {
        setError(insertError.message);
        return;
      }
    }
    setEditingSlot(null);
    await refresh();
  }

  async function removeSlot(slot: SlotRow) {
    if (!window.confirm("¿Quitar este ejercicio de la plantilla?")) return;
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("template_slots").delete().eq("id", slot.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await refresh();
  }

  async function moveSlot(slot: SlotRow, direction: "up" | "down") {
    const idx = templateSlots.findIndex((s) => s.id === slot.id);
    const neighborIdx = direction === "up" ? idx - 1 : idx + 1;
    if (neighborIdx < 0 || neighborIdx >= templateSlots.length) return;
    const neighbor = templateSlots[neighborIdx];

    setError(null);
    const supabase = createClient();
    const sentinel = -Math.abs(slot.slot_order) - 1000;
    const updates = [
      supabase.from("template_slots").update({ slot_order: sentinel }).eq("id", slot.id),
      supabase.from("template_slots").update({ slot_order: slot.slot_order }).eq("id", neighbor.id),
      supabase.from("template_slots").update({ slot_order: neighbor.slot_order }).eq("id", slot.id),
    ];
    for (const u of updates) {
      const { error: moveError } = await u;
      if (moveError) {
        setError(moveError.message);
        return;
      }
    }
    await refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Plantillas</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setSelectedId(t.id);
              setEditingSlot(null);
              setEditingMeta(false);
            }}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${
              t.id === selectedId
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {t.code}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {selectedTemplate && (
        <>
          {editingMeta ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <label className="flex flex-col gap-1 text-sm">
                Título
                <input
                  value={metaDraft.title}
                  onChange={(e) => setMetaDraft((d) => ({ ...d, title: e.target.value }))}
                  className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Foco
                <input
                  value={metaDraft.focus}
                  onChange={(e) => setMetaDraft((d) => ({ ...d, focus: e.target.value }))}
                  className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingMeta(false)} className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">
                  Cancelar
                </button>
                <button onClick={saveMeta} className="rounded-lg bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-50 dark:text-zinc-900">
                  Guardar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{selectedTemplate.title}</p>
                {selectedTemplate.focus && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{selectedTemplate.focus}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setMetaDraft({ title: selectedTemplate.title, focus: selectedTemplate.focus ?? "" });
                  setEditingMeta(true);
                }}
                className="text-sm"
              >
                Editar
              </button>
            </div>
          )}

          <ul className="flex flex-col gap-2">
            {templateSlots.map((slot, idx) => (
              <li
                key={slot.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {idx + 1}. {exercisesById.get(slot.exercise_id) ?? "(ejercicio archivado)"}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {slot.block} · {slotSummary(slot)}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <button onClick={() => moveSlot(slot, "up")} disabled={idx === 0} className="disabled:opacity-30">
                    ↑
                  </button>
                  <button
                    onClick={() => moveSlot(slot, "down")}
                    disabled={idx === templateSlots.length - 1}
                    className="disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button onClick={() => setEditingSlot(slot)}>Editar</button>
                  <button onClick={() => removeSlot(slot)} className="text-red-600 dark:text-red-400">
                    Quitar
                  </button>
                </div>
              </li>
            ))}
            {templateSlots.length === 0 && editingSlot !== "new" && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Esta plantilla todavía no tiene ejercicios.</p>
            )}
          </ul>

          {editingSlot ? (
            <SlotForm
              initial={editingSlot === "new" ? null : editingSlot}
              exercises={exercises}
              onCancel={() => setEditingSlot(null)}
              onSave={saveSlot}
            />
          ) : (
            <button
              onClick={() => setEditingSlot("new")}
              className="rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              + Agregar ejercicio
            </button>
          )}
        </>
      )}
    </div>
  );
}
