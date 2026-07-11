-- Clasificación fina de propósito de registro por ejercicio (7 valores),
-- ortogonal a category (grupo muscular/tag) y unit (no se toca, ver
-- clasificacion_ejercicios_lca.md). El logger de sesión pasa a decidir qué
-- campos mostrar por purpose (lib/exerciseLogging.ts), no por unit/category.

alter table public.exercises
  add column purpose text not null default 'fuerza_carga'
  check (purpose in (
    'fuerza_carga', 'isometria_tiempo', 'movilidad_repeticiones',
    'movilidad_tiempo', 'distancia_carga', 'potencia_tiempo_fijo',
    'cardio_intervalos'
  ));

-- side/rom_rpe: movilidad_repeticiones (+ side también en movilidad_tiempo).
-- posture_ok: distancia_carga.
alter table public.set_logs
  add column side text check (side in ('left', 'right', 'both')),
  add column rom_rpe integer check (rom_rpe between 0 and 10),
  add column posture_ok boolean;
