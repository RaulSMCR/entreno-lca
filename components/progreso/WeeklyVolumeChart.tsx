"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WeeklyVolumePoint } from "@/lib/progress";

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function WeeklyVolumeChart({ data }: { data: WeeklyVolumePoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-zinc-400">Sin volumen registrado todavía.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" vertical={false} />
        <XAxis dataKey="weekStart" tickFormatter={shortDate} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={40} />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(0)}kg`, "Volumen"]}
          labelFormatter={(label) => `Semana del ${shortDate(String(label))}`}
        />
        <Bar dataKey="totalKg" fill="#10b981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
