"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/progress";

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function E1rmChart({ history }: { history: TrendPoint[] }) {
  if (history.length < 2) {
    return <p className="text-sm text-zinc-400">Sin suficientes estimaciones para graficar.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={36} domain={["auto", "auto"]} />
        <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}kg`, "e1RM"]} labelFormatter={(label) => shortDate(String(label))} />
        <Line type="monotone" dataKey="e1rm" stroke="#2B7073" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
