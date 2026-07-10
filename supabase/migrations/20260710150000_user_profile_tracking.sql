-- Módulo de perfil de usuario, tracking corporal y calibración de cargas (U-1).
-- user_profiles es 1:1 por usuario: la PK es directamente auth.users.id (no hay
-- una columna user_id separada), a diferencia del resto de tablas del repo.

create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text,
  birth_date date,
  sex text check (sex in ('male', 'female', 'other')),
  height_cm numeric(5, 1),
  sport text not null default 'recreational_strength',
  injury_context text,
  surgery_date date,
  rehab_phase text check (rehab_phase in ('early_rehab', 'late_rehab', 'return_to_sport', 'performance')),
  weight_tracking_frequency_days integer not null default 7,
  inbody_tracking_frequency_days integer not null default 56,
  rm_retest_frequency_days integer not null default 84
);

create trigger set_updated_at before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- =========================================================================
-- body_weight_logs
-- =========================================================================
create table public.body_weight_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_at timestamptz not null default now(),
  weight_kg numeric(5, 2) not null,
  note text,
  source text not null default 'manual'
);

create trigger set_updated_at before update on public.body_weight_logs
  for each row execute function public.set_updated_at();

create index body_weight_logs_user_id_idx on public.body_weight_logs (user_id);

-- =========================================================================
-- inbody_scans
-- =========================================================================
create table public.inbody_scans (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scanned_at timestamptz not null,
  -- Composición principal
  weight_kg numeric(5, 2),
  body_fat_pct numeric(4, 1),
  muscle_mass_kg numeric(5, 2),
  fat_mass_kg numeric(5, 2),
  -- Agua corporal
  total_body_water_l numeric(5, 2),
  intracellular_water_l numeric(5, 2),
  extracellular_water_l numeric(5, 2),
  protein_kg numeric(5, 2),
  minerals_kg numeric(5, 2),
  -- Segmentos (kg por zona)
  muscle_right_arm_kg numeric(5, 2),
  muscle_left_arm_kg numeric(5, 2),
  muscle_trunk_kg numeric(5, 2),
  muscle_right_leg_kg numeric(5, 2),
  muscle_left_leg_kg numeric(5, 2),
  -- Índices
  bmi numeric(4, 1),
  visceral_fat_level integer,
  lsi_lower_limb_pct numeric(4, 1),
  note text
);

create trigger set_updated_at before update on public.inbody_scans
  for each row execute function public.set_updated_at();

create index inbody_scans_user_id_idx on public.inbody_scans (user_id);

-- =========================================================================
-- calibration_sessions
-- =========================================================================
create table public.calibration_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_type text not null check (session_type in ('A', 'B', 'C', 'D', '1RM_day', 'recalibration')),
  performed_at timestamptz not null,
  notes text,
  rehab_phase_at_time text
);

create trigger set_updated_at before update on public.calibration_sessions
  for each row execute function public.set_updated_at();

create index calibration_sessions_user_id_idx on public.calibration_sessions (user_id);

-- =========================================================================
-- tracking_reminders
-- =========================================================================
create table public.tracking_reminders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('body_weight', 'inbody_scan', 'rm_retest')),
  last_done_at timestamptz,
  next_due_at timestamptz,
  is_dismissed boolean not null default false,
  unique (user_id, type)
);

create trigger set_updated_at before update on public.tracking_reminders
  for each row execute function public.set_updated_at();

create index tracking_reminders_user_id_idx on public.tracking_reminders (user_id);

-- =========================================================================
-- Row Level Security
-- =========================================================================
alter table public.user_profiles enable row level security;
alter table public.body_weight_logs enable row level security;
alter table public.inbody_scans enable row level security;
alter table public.calibration_sessions enable row level security;
alter table public.tracking_reminders enable row level security;

create policy "own row only" on public.user_profiles
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "own rows only" on public.body_weight_logs
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on public.inbody_scans
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on public.calibration_sessions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on public.tracking_reminders
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================================
-- Grants explícitos (mismo motivo que 20260626175721_revoke_anon_grants.sql:
-- proyectos creados después del 30/05/2026 no reciben grants automáticos).
-- =========================================================================
grant select, insert, update, delete on table public.user_profiles to authenticated, service_role;
grant select, insert, update, delete on table public.body_weight_logs to authenticated, service_role;
grant select, insert, update, delete on table public.inbody_scans to authenticated, service_role;
grant select, insert, update, delete on table public.calibration_sessions to authenticated, service_role;
grant select, insert, update, delete on table public.tracking_reminders to authenticated, service_role;
