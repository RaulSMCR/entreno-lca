"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type ScheduleRow = Database["public"]["Tables"]["weekly_schedule"]["Row"];
type TemplateOption = { id: string; code: string; title: string };

const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

export function SemanaClient({
  initialSchedule,
  templates,
}: {
  initialSchedule: ScheduleRow[];
  templates: TemplateOption[];
}) {
  const [schedule, setSchedule] = useState(initialSchedule);
  const [error, setError] = useState<string | null>(null);

  function rowFor(weekday: string) {
    return schedule.find((s) => s.weekday === weekday) ?? null;
  }

  async function saveDay(weekday: string, patch: { day_template_id?: string | null; label?: string | null }) {
    setError(null);
    const current = rowFor(weekday);
    const supabase = createClient();
    const { data, error: saveError } = await supabase
      .from("weekly_schedule")
      .upsert(
        {
          weekday,
          day_template_id: patch.day_template_id !== undefined ? patch.day_template_id : current?.day_template_id ?? null,
          label: patch.label !== undefined ? patch.label : current?.label ?? null,
        },
        { onConflict: "user_id,weekday" }
      )
      .select()
      .single();

    if (saveError) {
      setError(saveError.message);
      return;
    }
    setSchedule((prev) => [...prev.filter((s) => s.weekday !== weekday), data]);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Semana</h1>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ul className="flex flex-col gap-2">
        {WEEKDAYS.map((weekday) => {
          const row = rowFor(weekday);
          return (
            <li
              key={weekday}
              className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="w-24 shrink-0 font-medium text-zinc-900 dark:text-zinc-50">{weekday}</span>

              <select
                value={row?.day_template_id ?? ""}
                onChange={(e) => saveDay(weekday, { day_template_id: e.target.value || null })}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">Descanso</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {t.title}
                  </option>
                ))}
              </select>

              <input
                defaultValue={row?.label ?? ""}
                onBlur={(e) => saveDay(weekday, { label: e.target.value || null })}
                placeholder="Etiqueta (opcional)"
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
