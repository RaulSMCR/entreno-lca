-- set_logs era único por (session_id, exercise_id, set_number), pero
-- exercise_id no identifica un slot: el mismo ejercicio puede repetirse en
-- más de un template_slot dentro de una plantilla (template A1 repite un
-- ejercicio en slot_order 7 y 9 — mismo caso ya corregido en
-- session_exercise_statuses). Sin esto, registrar la Serie 1 del segundo
-- slot pisaba/colisionaba con la Serie 1 del primero.
--
-- No hay set_logs reales todavía (0 filas al momento de esta migración), así
-- que no hace falta backfill antes de exigir NOT NULL.

alter table public.set_logs
  add column template_slot_id uuid references public.template_slots (id) on delete restrict;

alter table public.set_logs
  alter column template_slot_id set not null;

alter table public.set_logs
  drop constraint if exists set_logs_session_id_exercise_id_set_number_key;

alter table public.set_logs
  add constraint set_logs_session_id_template_slot_id_set_number_key
  unique (session_id, template_slot_id, set_number);

create index set_logs_template_slot_id_idx on public.set_logs (template_slot_id);
