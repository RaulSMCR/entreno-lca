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
