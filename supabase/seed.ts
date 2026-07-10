// Script de seed idempotente: lee seed_programa_lca.json (programa parseado desde el
// Excel original) y hace upsert de exercises, day_templates + template_slots, y
// weekly_schedule para el usuario autenticado. Correr con: pnpm seed
//
// El mapeo de las 6 plantillas a Lunes-Sábado viene del propio seed_programa_lca.json
// (weekly_schedule); es solo el punto de partida y queda editable desde app/semana
// (Prompt 1.2).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Database } from "../types/database";

type SeedExercise = {
  name: string;
  block: "principal" | "secundario";
  category: string;
  unit: "kg" | "seconds" | "meters" | "intervals" | "reps";
  rm_base_kg: number | null;
  biomech_note: string | null;
};

type SeedSlot = {
  order: number;
  block: "principal" | "secundario";
  exercise_name: string;
  scheme?: {
    sets: number;
    reps: number;
    pct_max: number;
    rpe_target: number;
    raw: string;
  };
  secondary?: {
    series: number;
    reps_or_time: string;
    intensity: string;
    rpe_target: number | null;
  };
};

type SeedDayTemplate = {
  code: string;
  title: string;
  focus: string | null;
  slots: SeedSlot[];
};

type SeedWeeklyEntry = {
  weekday: string;
  day_template_code: string | null;
  label: string | null;
};

type SeedFile = {
  exercises: SeedExercise[];
  day_templates: SeedDayTemplate[];
  weekly_schedule: SeedWeeklyEntry[];
};

type SeedEquipment = {
  name: string;
  type: "free_weight" | "machine" | "cable_stack" | "bodyweight" | "barbell";
  load_mode: "list" | "range" | "barbell";
  available_loads?: number[] | null;
  min_kg?: number | null;
  max_kg?: number | null;
  step_kg?: number | null;
  bar_kg?: number | null;
  plate_pairs?: number[] | null;
  micro_plates?: number[] | null;
};

const seedEquipment: SeedEquipment[] = [
  {
    name: "Barra olimpica + discos",
    type: "barbell",
    load_mode: "barbell",
    bar_kg: 20,
    plate_pairs: [1.25, 2.5, 5, 10, 15, 20],
    micro_plates: [0.5],
  },
  {
    name: "Mancuernas",
    type: "free_weight",
    load_mode: "list",
    available_loads: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40],
  },
  {
    name: "Polea regulable",
    type: "cable_stack",
    load_mode: "range",
    min_kg: 5,
    max_kg: 100,
    step_kg: 2.5,
  },
  {
    name: "Maquinas de tren superior",
    type: "machine",
    load_mode: "range",
    min_kg: 5,
    max_kg: 140,
    step_kg: 5,
  },
  {
    name: "Maquinas de pierna sana",
    type: "machine",
    load_mode: "range",
    min_kg: 5,
    max_kg: 200,
    step_kg: 5,
  },
  {
    name: "Peso corporal / movilidad",
    type: "bodyweight",
    load_mode: "range",
    min_kg: 0,
    max_kg: 150,
    step_kg: 1,
  },
  {
    name: "Slam ball",
    type: "free_weight",
    load_mode: "list",
    available_loads: [3, 5, 8, 10, 12, 15, 20],
  },
  {
    name: "Discos de agarre",
    type: "free_weight",
    load_mode: "list",
    available_loads: [1.25, 2.5, 5, 10, 15, 20],
  },
  {
    name: "Ergometro de brazos",
    type: "machine",
    load_mode: "range",
    min_kg: 1,
    max_kg: 20,
    step_kg: 1,
  },
];

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function equipmentNameForExercise(name: string): string | null {
  const normalized = normalizeName(name);

  if (normalized.includes("slam ball")) return "Slam ball";
  if (normalized.includes("plate pinch")) return "Discos de agarre";
  if (normalized.includes("ski") || normalized.includes("bicicleta")) return "Ergometro de brazos";
  if (normalized.includes("prensa") || normalized.includes("extension cuadriceps")) return "Maquinas de pierna sana";
  if (normalized.includes("hammer") || normalized.includes("remo articulado")) return "Maquinas de tren superior";
  if (
    normalized.includes("polea") ||
    normalized.includes("jalon") ||
    normalized.includes("gironda") ||
    normalized.includes("pallof") ||
    normalized.includes("woodchoppers")
  ) {
    return "Polea regulable";
  }
  if (
    normalized.includes("manc") ||
    normalized.includes("farmer") ||
    normalized.includes("curl antebrazo") ||
    normalized.includes("pecho apoyado banco")
  ) {
    return "Mancuernas";
  }
  if (normalized.includes("banca")) return "Barra olimpica + discos";
  if (
    normalized.includes("dominadas") ||
    normalized.includes("fondos") ||
    normalized.includes("suspensiones") ||
    normalized.includes("plancha") ||
    normalized.includes("rotaciones") ||
    normalized.includes("spine") ||
    normalized.includes("estiramiento") ||
    normalized.includes("movilidad")
  ) {
    return "Peso corporal / movilidad";
  }

  return null;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.SEED_USER_EMAIL;
const password = process.env.SEED_USER_PASSWORD;

if (!url || !anonKey || !email || !password) {
  throw new Error(
    "Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SEED_USER_EMAIL, SEED_USER_PASSWORD"
  );
}

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = resolve(here, "..", "seed_programa_lca.json");
const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedFile;

async function main() {
  const supabase = createClient<Database>(url!, anonKey!);

  const { error: signInError } = await supabase.auth.signInWithPassword({ email: email!, password: password! });
  if (signInError) throw signInError;

  const { data: equipment, error: equipmentError } = await supabase
    .from("equipment")
    .upsert(seedEquipment, { onConflict: "user_id,name" })
    .select("id, name");
  if (equipmentError) throw equipmentError;

  const equipmentIdByName = new Map(equipment.map((e) => [e.name, e.id]));

  const exerciseRows = seed.exercises.map((e) => ({
    name: e.name,
    block: e.block,
    category: e.category,
    unit: e.unit,
    equipment_id: equipmentNameForExercise(e.name)
      ? equipmentIdByName.get(equipmentNameForExercise(e.name)!) ?? null
      : null,
    rm_base_kg: e.rm_base_kg,
    e1rm_kg: e.rm_base_kg, // punto de partida del motor de cálculo (Prompt 1.3)
    biomech_note: e.biomech_note,
  }));

  const { data: exercises, error: exercisesError } = await supabase
    .from("exercises")
    .upsert(exerciseRows, { onConflict: "user_id,name" })
    .select("id, name");
  if (exercisesError) throw exercisesError;

  const exerciseIdByName = new Map(exercises.map((e) => [e.name, e.id]));

  const templateRows = seed.day_templates.map((t) => ({
    code: t.code,
    title: t.title,
    focus: t.focus,
  }));

  const { data: templates, error: templatesError } = await supabase
    .from("day_templates")
    .upsert(templateRows, { onConflict: "user_id,code" })
    .select("id, code");
  if (templatesError) throw templatesError;

  const templateIdByCode = new Map(templates.map((t) => [t.code, t.id]));

  const slotRows = seed.day_templates.flatMap((t) => {
    const dayTemplateId = templateIdByCode.get(t.code);
    if (!dayTemplateId) throw new Error(`Plantilla no encontrada tras el upsert: ${t.code}`);

    return t.slots.map((s) => {
      const exerciseId = exerciseIdByName.get(s.exercise_name);
      if (!exerciseId) {
        throw new Error(`Ejercicio no encontrado: "${s.exercise_name}" (plantilla ${t.code})`);
      }

      const base = {
        day_template_id: dayTemplateId,
        slot_order: s.order,
        block: s.block,
        exercise_id: exerciseId,
      };

      if (s.block === "principal" && s.scheme) {
        return {
          ...base,
          sets: s.scheme.sets,
          reps: s.scheme.reps,
          pct_max: s.scheme.pct_max,
          rpe_target: s.scheme.rpe_target,
          scheme_raw: s.scheme.raw,
        };
      }
      if (s.block === "secundario" && s.secondary) {
        return {
          ...base,
          sets: s.secondary.series,
          reps_or_time: s.secondary.reps_or_time,
          intensity_note: s.secondary.intensity,
          rpe_target: s.secondary.rpe_target,
        };
      }
      throw new Error(`Slot sin scheme/secondary válido: ${t.code} #${s.order}`);
    });
  });

  const { error: slotsError } = await supabase
    .from("template_slots")
    .upsert(slotRows, { onConflict: "day_template_id,slot_order" });
  if (slotsError) throw slotsError;

  const scheduleRows = seed.weekly_schedule.map((w) => ({
    weekday: w.weekday,
    day_template_id: w.day_template_code ? templateIdByCode.get(w.day_template_code) ?? null : null,
    label: w.label,
  }));

  const { error: scheduleError } = await supabase
    .from("weekly_schedule")
    .upsert(scheduleRows, { onConflict: "user_id,weekday" });
  if (scheduleError) throw scheduleError;

  console.log(
    `Seed completo: ${equipment.length} equipos, ${exercises.length} ejercicios, ${templates.length} plantillas, ${slotRows.length} slots, ${scheduleRows.length} dias de horario.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
