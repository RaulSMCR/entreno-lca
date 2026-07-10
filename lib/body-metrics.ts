// Métricas corporales (U-1 Parte C): funciones puras, sin I/O — igual que
// lib/engine.ts y lib/training-theory.ts, quien las llama es responsable de leer
// los datos de Supabase/Dexie.

export function calculateAge(birthDate: string | Date, today: Date = new Date()): number {
  const birth = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

// LSI (Limb Symmetry Index): estándar clínico de rehab de LCA. >= 90% es el
// criterio de alta funcional más usado en la literatura (no es un umbral nuestro).
export function calculateLSI(weakLimbKg: number, strongLimbKg: number): number {
  return (weakLimbKg / strongLimbKg) * 100;
}

export type LSILevel = "deficit_severo" | "deficit_moderado" | "deficit_leve" | "simetria";

export type LSIInterpretation = {
  level: LSILevel;
  message: string;
  color: string;
};

export function getLSIInterpretation(lsiPct: number): LSIInterpretation {
  if (lsiPct < 70) {
    return {
      level: "deficit_severo",
      message: "Déficit severo de simetría entre piernas: prioridad clínica alta.",
      color: "red",
    };
  }
  if (lsiPct < 80) {
    return {
      level: "deficit_moderado",
      message: "Déficit moderado de simetría entre piernas.",
      color: "orange",
    };
  }
  if (lsiPct < 90) {
    return {
      level: "deficit_leve",
      message: "Déficit leve: cerca del umbral de alta funcional (90%).",
      color: "yellow",
    };
  }
  return {
    level: "simetria",
    message: "Simetría entre piernas dentro del criterio de alta funcional (LSI >= 90%).",
    color: "green",
  };
}

export type WeightLog = { logged_at: string; weight_kg: number };

const MIN_LOGS_FOR_ROLLING_AVERAGE = 3;

// null si hay menos de 3 registros en la ventana: un promedio con 1-2 puntos no es
// representativo y puede disparar falsas tendencias.
export function getRollingAverageWeight(logs: WeightLog[], days = 7): number | null {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const inWindow = logs.filter((l) => new Date(l.logged_at).getTime() >= cutoff);
  if (inWindow.length < MIN_LOGS_FOR_ROLLING_AVERAGE) return null;
  const sum = inWindow.reduce((acc, l) => acc + l.weight_kg, 0);
  return sum / inWindow.length;
}

export type WeightTrendDirection = "up" | "down" | "stable" | "insufficient_data";

export type WeightTrend = {
  direction: WeightTrendDirection;
  deltaKgPerWeek: number | null;
  message: string;
};

const STABLE_THRESHOLD_KG_PER_WEEK = 0.3;

// Requiere al menos 2 registros para estimar una pendiente; menos que eso no
// alcanza para hablar de "tendencia".
export function getWeightTrend(logs: WeightLog[]): WeightTrend {
  if (logs.length < 2) {
    return { direction: "insufficient_data", deltaKgPerWeek: null, message: "Registrá al menos 2 pesajes para ver una tendencia." };
  }

  const sorted = [...logs].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const daysBetween = (new Date(last.logged_at).getTime() - new Date(first.logged_at).getTime()) / (24 * 60 * 60 * 1000);

  if (daysBetween <= 0) {
    return { direction: "insufficient_data", deltaKgPerWeek: null, message: "Registrá pesajes en fechas distintas para ver una tendencia." };
  }

  const deltaKgPerWeek = ((last.weight_kg - first.weight_kg) / daysBetween) * 7;

  if (Math.abs(deltaKgPerWeek) < STABLE_THRESHOLD_KG_PER_WEEK) {
    return { direction: "stable", deltaKgPerWeek, message: "Peso estable." };
  }

  const direction: WeightTrendDirection = deltaKgPerWeek > 0 ? "up" : "down";
  const verb = direction === "up" ? "subiendo" : "bajando";
  return {
    direction,
    deltaKgPerWeek,
    message: `Peso ${verb} ${Math.abs(deltaKgPerWeek).toFixed(2)} kg/semana.`,
  };
}
