"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RpeBucket } from "@/lib/progress";

export function RpeDistributionChart({ data }: { data: RpeBucket[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-zinc-400">Sin RPE registrado todavía.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" vertical={false} />
        <XAxis dataKey="rpe" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
        <Tooltip formatter={(value) => [String(value), "Series"]} labelFormatter={(label) => `RPE ${label}`} />
        <Bar dataKey="count" fill="#2B7073" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
