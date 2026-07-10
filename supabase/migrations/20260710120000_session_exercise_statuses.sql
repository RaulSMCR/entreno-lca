-- R-3: estado por ejercicio dentro de una sesión (pendiente/en curso/parcial/
-- completo/omitido), con la razón de omisión cuando aplica. Habilita el
-- navegador de sesión (R-2), el skip modal (R-3) y el análisis de patrones (R-4).

create table public.session_exercise_statuses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  session_id uuid not null references public.sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  template_slot_id uuid references public.template_slots (id) on delete set null,

  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'partial', 'completed', 'skipped')),

  skip_reason text
    check (skip_reason in (
      'station_occupied',
      'equipment_unavailable',
      'physical_discomfort',
      'no_time',
      'other'
    )),
  skip_note text,

  sets_planned int not null,
  sets_completed int not null default 0,

  -- Orden en que el usuario ejecutó el ejercicio (puede diferir del slot_order).
  execution_order int,

  started_at timestamptz,
  completed_at timestamptz,
  actual_duration_seconds int,

  unique (session_id, exercise_id)
);

create trigger set_updated_at before update on public.session_exercise_statuses
  for each row execute function public.set_updated_at();

create index session_exercise_statuses_user_id_idx on public.session_exercise_statuses (user_id);
create index session_exercise_statuses_session_id_idx on public.session_exercise_statuses (session_id);
create index session_exercise_statuses_user_exercise_idx on public.session_exercise_statuses (user_id, exercise_id);
create index session_exercise_statuses_skip_reason_idx on public.session_exercise_statuses (user_id, skip_reason)
  where skip_reason is not null;

alter table public.session_exercise_statuses enable row level security;

create policy "own rows only" on public.session_exercise_statuses
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on table public.session_exercise_statuses to authenticated, service_role;
revoke all on table public.session_exercise_statuses from anon;
