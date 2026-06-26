-- Postgres otorga automáticamente privilegios a anon/authenticated/service_role en
-- cada tabla nueva del schema public (vía pg_default_acl del rol "postgres", que es
-- quien corre las migraciones), sin importar que no se haya hecho un GRANT explícito.
-- Esta app es de un solo usuario autenticado: anon no debe poder tocar ninguna tabla,
-- ni siquiera estando RLS de por medio. Revocamos lo ya otorgado y cambiamos el default
-- para que las tablas futuras tampoco se lo otorguen.

alter default privileges for role postgres in schema public revoke all on tables from anon;

revoke all on table public.equipment from anon;
revoke all on table public.exercises from anon;
revoke all on table public.day_templates from anon;
revoke all on table public.template_slots from anon;
revoke all on table public.weekly_schedule from anon;
revoke all on table public.sessions from anon;
revoke all on table public.set_logs from anon;
revoke all on table public.e1rm_estimates from anon;
