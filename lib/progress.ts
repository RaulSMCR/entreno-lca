// Cálculos puros para el panel de prognosis (Prompt 1.5). Sin I/O: reciben
// datos ya leídos (de Dexie, con Supabase como fallback de hidratación).

export type TrendPoint = { date: string; e1rm: number };

// Proyección lineal simple a partir del ritmo reciente: toma los últimos
// `windowSize` puntos y extiende la recta que une el primero y el último.
export function projectE1rm(history: TrendPoint[], weeksAhead = 4, windowSize = 5): number | null {
  if (history.length < 2) return null;

  const window = history.slice(-windowSize);
  const first = window[0];
  const last = window[window.length - 1];
  const daysElapsed = (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86_400_000;
  if (daysElapsed <= 0) return last.e1rm;

  const ratePerDay = (last.e1rm - first.e1rm) / daysElapsed;
  return last.e1rm + ratePerDay * weeksAhead * 7;
}

// Estancamiento: en las últimas `n` estimaciones no se superó el mejor valor
// previo a esa ventana. Necesita al menos n+1 puntos para tener una base de
// comparación.
export function isStagnant(history: TrendPoint[], n = 4): boolean {
  if (history.length <= n) return false;

  const baseline = Math.max(...history.slice(0, history.length - n).map((p) => p.e1rm));
  const recentMax = Math.max(...history.slice(-n).map((p) => p.e1rm));
  return recentMax <= baseline;
}

export type VolumeSet = { load: number | null; reps: number | null };

export function weeklyVolume(sets: VolumeSet[]): number {
  return sets.reduce((sum, s) => sum + (s.load ?? 0) * (s.reps ?? 0), 0);
}

export type DeloadReason = "stagnation" | "chronic_high_rpe";

export type DeloadCheck = { suggested: boolean; reasons: DeloadReason[] };

// RPE crónicamente alto: las últimas `n` sesiones (en orden cronológico) con
// RPE medio en o por encima de `threshold` — señal de fatiga acumulada aunque
// el e1RM todavía no se haya estancado.
export function isChronicHighRpe(rpeAvgsChronological: number[], n = 3, threshold = 9): boolean {
  if (rpeAvgsChronological.length < n) return false;
  return rpeAvgsChronological.slice(-n).every((rpe) => rpe >= threshold);
}

// Combina estancamiento de e1RM y RPE crónicamente alto: cualquiera de los dos
// alcanza para proponer un deload.
export function deloadSuggestion(history: TrendPoint[], rpeAvgsChronological: number[]): DeloadCheck {
  const reasons: DeloadReason[] = [];
  if (isStagnant(history)) reasons.push("stagnation");
  if (isChronicHighRpe(rpeAvgsChronological)) reasons.push("chronic_high_rpe");
  return { suggested: reasons.length > 0, reasons };
}

export type WeeklyVolumePoint = { weekStart: string; totalKg: number };

// Agrupa por semana (lunes a domingo, en hora local) para graficar la tendencia
// de volumen; `weeks` recorta a las últimas N semanas con datos.
export function weeklyVolumeSeries(sets: { load: number | null; reps: number | null; date: string }[], weeks = 8): WeeklyVolumePoint[] {
  const byWeek = new Map<string, number>();
  for (const s of sets) {
    const week = isoWeekStart(s.date);
    byWeek.set(week, (byWeek.get(week) ?? 0) + (s.load ?? 0) * (s.reps ?? 0));
  }
  return Array.from(byWeek.entries())
    .map(([weekStart, totalKg]) => ({ weekStart, totalKg }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .slice(-weeks);
}

function isoWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const mondayOffset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type RpeBucket = { rpe: number; count: number };

// Distribución de esfuerzo: cuántas series caen en cada valor de RPE reportado.
export function rpeDistribution(rpeValues: number[]): RpeBucket[] {
  const counts = new Map<number, number>();
  for (const rpe of rpeValues) counts.set(rpe, (counts.get(rpe) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([rpe, count]) => ({ rpe, count }))
    .sort((a, b) => a.rpe - b.rpe);
}

export type SessionRpe = { sessionId: string; date: string; avgRpe: number };

export function averageRpePerSession(
  logs: { session_id: string; rpe_reported: number | null }[],
  sessionDates: Record<string, string>
): SessionRpe[] {
  const bySession = new Map<string, number[]>();
  for (const log of logs) {
    if (log.rpe_reported == null) continue;
    const arr = bySession.get(log.session_id) ?? [];
    arr.push(log.rpe_reported);
    bySession.set(log.session_id, arr);
  }

  return Array.from(bySession.entries())
    .map(([sessionId, rpes]) => ({
      sessionId,
      date: sessionDates[sessionId] ?? "",
      avgRpe: rpes.reduce((a, b) => a + b, 0) / rpes.length,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
