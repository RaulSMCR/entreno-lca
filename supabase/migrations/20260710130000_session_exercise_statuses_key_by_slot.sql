-- Corrige la clave de unicidad de session_exercise_statuses: un mismo
-- exercise_id puede aparecer en más de un template_slot dentro de la misma
-- plantilla (confirmado en datos reales: template A1 usa el mismo ejercicio
-- en slot_order 7 y 9), así que exercise_id NO es único por sesión. La clave
-- real es (session_id, template_slot_id), tal como indicaba el prompt
-- original de R-3 ("upsert por session_id, template_slot_id").

update public.session_exercise_statuses
  set template_slot_id = (
    select id from public.template_slots ts
    where ts.exercise_id = session_exercise_statuses.exercise_id
    limit 1
  )
  where template_slot_id is null;

alter table public.session_exercise_statuses
  alter column template_slot_id set not null;

alter table public.session_exercise_statuses
  drop constraint if exists session_exercise_statuses_session_id_exercise_id_key;

alter table public.session_exercise_statuses
  add constraint session_exercise_statuses_session_id_template_slot_id_key
  unique (session_id, template_slot_id);
