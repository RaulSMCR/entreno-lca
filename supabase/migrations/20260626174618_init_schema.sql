-- Entreno LCA: esquema inicial (equipment, exercises, day_templates, template_slots,
-- weekly_schedule, sessions, set_logs, e1rm_estimates), RLS y grants explícitos.
--
-- Proyectos creados después del 30 de mayo de 2026 no reciben grants automáticos
-- de la Data API: cada tabla necesita un GRANT explícito para que PostgREST/
-- supabase-js puedan verla, además de las políticas de RLS.
-- https://supabase.com/docs/guides/api/securing-your-api

create extension if not exists pgcrypto;

-- updated_at se refresca solo en cada UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================================
-- equipment
-- =========================================================================
create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('free_weight', 'machine', 'cable_stack', 'bodyweight', 'barbell')),
  load_mode text not null check (load_mode in ('list', 'range', 'barbell')),
  available_loads numeric[],
  min_kg numeric,
  max_kg numeric,
  step_kg numeric,
  bar_kg numeric,
  plate_pairs numeric[],
  micro_plates numeric[],
  unique (user_id, name)
);

create trigger set_updated_at before update on public.equipment
  for each row execute function public.set_updated_at();

create index equipment_user_id_idx on public.equipment (user_id);

-- =========================================================================
-- exercises
-- =========================================================================
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  block text not null check (block in ('principal', 'secundario')),
  category text,
  unit text not null check (unit in ('kg', 'seconds', 'meters', 'intervals', 'reps')),
  equipment_id uuid references public.equipment (id) on delete set null,
  e1rm_kg numeric,
  rm_base_kg numeric,
  biomech_note text,
  is_active boolean not null default true,
  unique (user_id, name)
);

create trigger set_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();

create index exercises_user_id_idx on public.exercises (user_id);
create index exercises_equipment_id_idx on public.exercises (equipment_id);

-- =========================================================================
-- day_templates
-- =========================================================================
create table public.day_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code text not null,
  title text not null,
  focus text,
  unique (user_id, code)
);

create trigger set_updated_at before update on public.day_templates
  for each row execute function public.set_updated_at();

create index day_templates_user_id_idx on public.day_templates (user_id);

-- =========================================================================
-- template_slots
-- =========================================================================
create table public.template_slots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_template_id uuid not null references public.day_templates (id) on delete cascade,
  slot_order int not null,
  block text not null check (block in ('principal', 'secundario')),
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  sets int,
  reps int,
  pct_max numeric,
  rpe_target numeric,
  reps_or_time text,
  intensity_note text,
  scheme_raw text,
  unique (day_template_id, slot_order)
);

create trigger set_updated_at before update on public.template_slots
  for each row execute function public.set_updated_at();

create index template_slots_user_id_idx on public.template_slots (user_id);
create index template_slots_day_template_id_idx on public.template_slots (day_template_id);
create index template_slots_exercise_id_idx on public.template_slots (exercise_id);

-- =========================================================================
-- weekly_schedule
-- =========================================================================
create table public.weekly_schedule (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weekday text not null check (
    weekday in ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo')
  ),
  day_template_id uuid references public.day_templates (id) on delete set null,
  label text,
  unique (user_id, weekday)
);

create trigger set_updated_at before update on public.weekly_schedule
  for each row execute function public.set_updated_at();

create index weekly_schedule_user_id_idx on public.weekly_schedule (user_id);
create index weekly_schedule_day_template_id_idx on public.weekly_schedule (day_template_id);

-- =========================================================================
-- sessions
-- =========================================================================
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  day_template_id uuid references public.day_templates (id) on delete set null,
  bodyweight_kg numeric,
  readiness int check (readiness between 1 and 5),
  notes text
);

create trigger set_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();

create index sessions_user_id_idx on public.sessions (user_id);
create index sessions_date_idx on public.sessions (date);

-- =========================================================================
-- set_logs
-- =========================================================================
create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  set_number int not null,
  target_load_kg numeric,
  actual_load_kg numeric,
  target_reps int,
  actual_reps int,
  rpe_reported numeric,
  rpe_at_rep int,
  is_failure boolean not null default false,
  note text,
  synced_from_local boolean not null default false,
  unique (session_id, exercise_id, set_number)
);

create trigger set_updated_at before update on public.set_logs
  for each row execute function public.set_updated_at();

create index set_logs_user_id_idx on public.set_logs (user_id);
create index set_logs_session_id_idx on public.set_logs (session_id);
create index set_logs_exercise_id_idx on public.set_logs (exercise_id);

-- =========================================================================
-- e1rm_estimates
-- =========================================================================
create table public.e1rm_estimates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  date date not null,
  e1rm_kg numeric not null,
  method text,
  source_session_id uuid references public.sessions (id) on delete set null
);

create trigger set_updated_at before update on public.e1rm_estimates
  for each row execute function public.set_updated_at();

create index e1rm_estimates_user_id_idx on public.e1rm_estimates (user_id);
create index e1rm_estimates_exercise_id_idx on public.e1rm_estimates (exercise_id);

-- =========================================================================
-- Row Level Security: cada usuario solo ve/edita sus propias filas.
-- =========================================================================
alter table public.equipment enable row level security;
alter table public.exercises enable row level security;
alter table public.day_templates enable row level security;
alter table public.template_slots enable row level security;
alter table public.weekly_schedule enable row level security;
alter table public.sessions enable row level security;
alter table public.set_logs enable row level security;
alter table public.e1rm_estimates enable row level security;

create policy "own rows only" on public.equipment
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on public.exercises
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on public.day_templates
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on public.template_slots
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on public.weekly_schedule
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on public.sessions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on public.set_logs
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on public.e1rm_estimates
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================================
-- Grants explícitos para la Data API (anon no tiene acceso: la app es de
-- un solo usuario autenticado, no hay datos públicos).
-- =========================================================================
grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on table public.equipment to authenticated, service_role;
grant select, insert, update, delete on table public.exercises to authenticated, service_role;
grant select, insert, update, delete on table public.day_templates to authenticated, service_role;
grant select, insert, update, delete on table public.template_slots to authenticated, service_role;
grant select, insert, update, delete on table public.weekly_schedule to authenticated, service_role;
grant select, insert, update, delete on table public.sessions to authenticated, service_role;
grant select, insert, update, delete on table public.set_logs to authenticated, service_role;
grant select, insert, update, delete on table public.e1rm_estimates to authenticated, service_role;
