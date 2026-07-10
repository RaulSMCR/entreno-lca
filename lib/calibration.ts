// Calibración de cargas (U-2 Parte A): clasificación de protocolo por ejercicio y
// estimación de e1RM a partir de tests de nRM. Funciones puras, sin I/O.
//
// EXERCISE_CALIBRATION_MAP usa los nombres EXACTOS de seed_programa_lca.json (con
// tildes) porque supabase/seed.ts matchea ejercicios por nombre exacto
// (onConflict: "user_id,name") — una entrada sin tilde no matchea silenciosamente.
// Cubre los 33 ejercicios del seed (test: calibration.test.ts lo verifica contra
// el propio seed).

export type CalibrationProtocol =
  | "direct_1rm"
  | "five_rm"
  | "ten_rm"
  | "twelve_rm"
  | "fifteen_rm"
  | "time_hold"
  | "distance_load"
  | "power_output"
  | "mobility_rpe";

export const EXERCISE_CALIBRATION_MAP: Record<string, CalibrationProtocol> = {
  "Press de Banca Plano (Barra)": "direct_1rm",
  "Press de Banca Inclinado (Fuerza)": "direct_1rm",
  "Dominadas Lastradas (Pull-up)": "direct_1rm",

  "Press Militar Sentado Manc.": "five_rm",
  "Remo Banco Inclinado Mancuernas": "five_rm",
  "Remo Articulado Unilateral": "five_rm",
  "Fondos en Paralelas": "five_rm",
  // Variante de fuerza de la prensa unilateral (3x6 @85%, seed día C2): se
  // mantiene como test de 5RM y no 1RM directo por ser una pierna en rehab.
  "Prensa Unilateral Pierna SANA (Fuerza)": "five_rm",

  "Jalón al Pecho Supino": "ten_rm",
  "Jalón al Pecho Prono Pesado": "ten_rm",
  "Remo Gironda con Cuerda/Faja": "ten_rm",
  "Remo Gironda Pesado (Pull F)": "ten_rm",
  "Press de Hombro Hammer": "ten_rm",
  "Prensa Unilateral Pierna SANA": "ten_rm",
  // Prescritos a 10 reps en el seed (día A2/B2): mismo protocolo que sus pares.
  "Press Militar Mancuerna": "ten_rm",
  "Dominadas Supinas (Volumen)": "ten_rm",

  "Extensión Cuádriceps (SANA)": "twelve_rm",
  "Remo Alto Polea con Fat Grips": "twelve_rm",
  "Woodchoppers Sentado (Polea)": "twelve_rm",
  "Pallof Press Sentado (Polea)": "twelve_rm",
  // Prescritos a 12 reps en el seed (día A2/B2): mismo protocolo que sus pares.
  "Press de Banca Plano (Volumen)": "twelve_rm",
  "Remo de Pecho Apoyado Banco": "twelve_rm",

  "Curl Antebrazo con Fat Grips": "fifteen_rm",

  "Suspensiones Faja BJJ en Barra": "time_hold",
  "Plate Pinch (Pinza de Dedos)": "time_hold",
  "Plancha Frontal Pierna Sana": "time_hold",

  "Suitcase Carry (Farmer Unilateral)": "distance_load",

  "Slam Ball Sentado": "power_output",
  "SkiErg o Bicicleta de Brazos": "power_output",

  "Rotaciones Torácicas Cuadrupedia": "mobility_rpe",
  "Spine Openers (Libro)": "mobility_rpe",
  "Estiramiento Flexores de Cadera (Sana)": "mobility_rpe",
  "Movilidad Cápsula Posterior Hombro": "mobility_rpe",
};

const EPLEY_MULTIPLIER_BY_REPS: Record<number, number> = {
  5: 1.167,
  10: 1.333,
  12: 1.4,
  15: 1.5,
};

// Epley: e1RM = carga x (1 + reps/30). Los multiplicadores de arriba son ese
// mismo cálculo pre-redondeado a 3 decimales para los reps estándar del programa,
// pero la fórmula general cubre cualquier reps <= 15 (ej. un 8RM real).
export function estimateE1RMFromNRM(loadKg: number, reps: number): number {
  if (reps > 15) {
    throw new Error("estimateE1RMFromNRM solo aplica para reps <= 15 (Epley pierde precisión más allá)");
  }
  const multiplier = EPLEY_MULTIPLIER_BY_REPS[reps] ?? 1 + reps / 30;
  return Math.round(loadKg * multiplier * 10) / 10;
}

export type CalibrationSessionType = "A" | "B" | "C" | "D" | "1RM_day";

export const CALIBRATION_SESSION_EXERCISES: Record<CalibrationSessionType, string[]> = {
  A: [
    "Press de Banca Plano (Barra)",
    "Press de Banca Inclinado (Fuerza)",
    "Press Militar Sentado Manc.",
    "Dominadas Lastradas (Pull-up)",
    "Jalón al Pecho Supino",
    "Jalón al Pecho Prono Pesado",
    "Press de Hombro Hammer",
  ],
  B: [
    "Remo Banco Inclinado Mancuernas",
    "Remo Articulado Unilateral",
    "Fondos en Paralelas",
    "Remo Gironda con Cuerda/Faja",
    "Remo Gironda Pesado (Pull F)",
    "Remo Alto Polea con Fat Grips",
    "Curl Antebrazo con Fat Grips",
  ],
  C: [
    "Suspensiones Faja BJJ en Barra",
    "Plate Pinch (Pinza de Dedos)",
    "Plancha Frontal Pierna Sana",
    "Pallof Press Sentado (Polea)",
    "Woodchoppers Sentado (Polea)",
    "Suitcase Carry (Farmer Unilateral)",
    "Slam Ball Sentado",
    "SkiErg o Bicicleta de Brazos",
  ],
  D: [
    "Prensa Unilateral Pierna SANA",
    "Extensión Cuádriceps (SANA)",
    "Press de Banca Plano (Barra)", // spot check
    "Dominadas Lastradas (Pull-up)", // spot check
  ],
  "1RM_day": ["Press de Banca Plano (Barra)", "Press de Banca Inclinado (Fuerza)", "Dominadas Lastradas (Pull-up)"],
};

export type RehabPhase = "early_rehab" | "late_rehab" | "return_to_sport" | "performance";

export function isCalibrationSessionEnabled(
  sessionType: CalibrationSessionType,
  rehabPhase: RehabPhase | null
): { enabled: boolean; reason?: string } {
  if (sessionType === "D" && rehabPhase !== "late_rehab" && rehabPhase !== "return_to_sport" && rehabPhase !== "performance") {
    return { enabled: false, reason: "La Sesión D requiere clearance para ejercicio de pierna." };
  }
  return { enabled: true };
}
