-- Desvío entre la duración estimada (lib/session-time.ts) y la real de la
-- sesión, para calibrar a futuro los parámetros de estimación.

alter table public.sessions
  add column session_duration_variance_pct real;
