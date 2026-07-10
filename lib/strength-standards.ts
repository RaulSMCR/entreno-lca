// Dashboard de estándares de fuerza (U-4). Funciones puras, sin I/O. Solo cubre
// los 3 ejercicios con protocolo direct_1rm (lib/calibration.ts) — no hay
// sentadilla ni peso muerto en este programa (rehab LCA).

export type StrengthLevel = "below_principiante" | "principiante" | "intermedio" | "avanzado" | "elite";

export type StrengthRatios = { principiante: number; intermedio: number; avanzado: number; elite: number };

export type StrengthStandard = {
  exerciseName: string;
  exercisePatterns: string[];
  male: StrengthRatios;
  female: StrengthRatios;
  source: string;
  caveat: string;
};

export const STRENGTH_STANDARDS: StrengthStandard[] = [
  {
    exerciseName: "Press de Banca Plano",
    exercisePatterns: ["press de banca plano", "bench press"],
    male: { principiante: 0.5, intermedio: 1.0, avanzado: 1.25, elite: 1.7 },
    female: { principiante: 0.3, intermedio: 0.6, avanzado: 0.85, elite: 1.2 },
    source: "Van den Hoek et al. 2024 (adaptado para recreacional)",
    caveat: "Press plano con barra, sin equipamiento de soporte.",
  },
  {
    exerciseName: "Press de Banca Inclinado",
    exercisePatterns: ["press de banca inclinado", "incline bench"],
    male: { principiante: 0.4, intermedio: 0.85, avanzado: 1.05, elite: 1.45 },
    female: { principiante: 0.25, intermedio: 0.5, avanzado: 0.7, elite: 1.0 },
    source: "Estimación derivada: ~85% del estándar de press plano",
    caveat: "El inclinado tiene menos datos de referencia directos.",
  },
  {
    exerciseName: "Dominadas Lastradas",
    exercisePatterns: ["dominadas", "pull-up", "pullup"],
    male: { principiante: 0.1, intermedio: 0.3, avanzado: 0.5, elite: 0.8 },
    female: { principiante: 0.05, intermedio: 0.15, avanzado: 0.3, elite: 0.55 },
    source: "Consenso Barbell Medicine / ExRx.net",
    caveat: "Ratio = lastre añadido / peso corporal (peso corporal no incluido).",
  },
];

export const STRENGTH_STANDARDS_DISCLAIMER =
  "Estos estándares se basan en datos de competencias de powerlifting (Van den Hoek et al., 2024, " +
  "n=809.986, drug-tested). El nivel Elite corresponde al percentil 90 de powerlifters competitivos. " +
  "En fase de rehabilitación LCA, el LSI >= 90% es el indicador clínico prioritario.";

export function getStrengthStandard(exerciseName: string): StrengthStandard | null {
  const normalized = exerciseName.toLowerCase();
  return STRENGTH_STANDARDS.find((s) => s.exercisePatterns.some((p) => normalized.includes(p))) ?? null;
}

export type StrengthLevelEvaluation = {
  ratio: number;
  currentLevel: StrengthLevel;
  nextLevel: StrengthLevel | null;
  kgToNextLevel: number | null;
  percentToNextLevel: number | null;
  message: string;
};

const LEVEL_ORDER: StrengthLevel[] = ["below_principiante", "principiante", "intermedio", "avanzado", "elite"];

export function evaluateStrengthLevel(
  e1rmKg: number,
  bodyWeightKg: number,
  standard: StrengthStandard,
  sex: "male" | "female"
): StrengthLevelEvaluation {
  const ratios = standard[sex];
  const ratio = e1rmKg / bodyWeightKg;

  let currentLevel: StrengthLevel = "below_principiante";
  if (ratio >= ratios.elite) currentLevel = "elite";
  else if (ratio >= ratios.avanzado) currentLevel = "avanzado";
  else if (ratio >= ratios.intermedio) currentLevel = "intermedio";
  else if (ratio >= ratios.principiante) currentLevel = "principiante";

  const currentIdx = LEVEL_ORDER.indexOf(currentLevel);
  const nextLevel = currentIdx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[currentIdx + 1] : null;

  if (!nextLevel) {
    return {
      ratio,
      currentLevel,
      nextLevel: null,
      kgToNextLevel: null,
      percentToNextLevel: null,
      message: `Nivel elite alcanzado (${ratio.toFixed(2)}x tu peso).`,
    };
  }

  const nextRatio = ratios[nextLevel as Exclude<StrengthLevel, "below_principiante">];
  const kgToNextLevel = Math.max(0, nextRatio * bodyWeightKg - e1rmKg);
  const percentToNextLevel = Math.min(100, Math.max(0, (ratio / nextRatio) * 100));

  return {
    ratio,
    currentLevel,
    nextLevel,
    kgToNextLevel,
    percentToNextLevel,
    message: `${ratio.toFixed(2)}x tu peso — faltan ${kgToNextLevel.toFixed(1)}kg para nivel ${nextLevel}.`,
  };
}
