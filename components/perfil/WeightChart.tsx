"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type WeightPoint = { logged_at: string; weight_kg: number };

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function WeightChart({ data }: { data: WeightPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-zinc-400">Sin pesajes registrados todavía.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" vertical={false} />
        <XAxis dataKey="logged_at" tickFormatter={shortDate} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={40} domain={["dataMin - 2", "dataMax + 2"]} />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(1)}kg`, "Peso"]}
          labelFormatter={(label) => shortDate(String(label))}
        />
        <Line type="monotone" dataKey="weight_kg" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
