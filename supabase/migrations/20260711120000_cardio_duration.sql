-- Panel de cardio (SkiErg/Bicicleta): la meta y el registro de duración se
-- miden en segundos, separados de reps/carga, que no aplican a este tipo de
-- ejercicio.

alter table public.template_slots
  add column target_duration_seconds integer;

alter table public.set_logs
  add column actual_duration_seconds integer;
