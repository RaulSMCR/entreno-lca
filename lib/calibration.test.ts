import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CALIBRATION_SESSION_EXERCISES,
  EXERCISE_CALIBRATION_MAP,
  estimateE1RMFromNRM,
  isCalibrationSessionEnabled,
} from "./calibration";

describe("estimateE1RMFromNRM", () => {
  it("aplica el multiplicador de Epley para 5RM", () => {
    expect(estimateE1RMFromNRM(100, 5)).toBe(116.7);
  });

  it("aplica el multiplicador de Epley para 10RM", () => {
    expect(estimateE1RMFromNRM(100, 10)).toBe(133.3);
  });

  it("rechaza reps > 15", () => {
    expect(() => estimateE1RMFromNRM(100, 20)).toThrow();
  });
});

describe("isCalibrationSessionEnabled", () => {
  it("bloquea la Sesión D en early_rehab", () => {
    const result = isCalibrationSessionEnabled("D", "early_rehab");
    expect(result.enabled).toBe(false);
    expect(result.reason).toMatch(/clearance/);
  });

  it("habilita la Sesión D en late_rehab o después", () => {
    expect(isCalibrationSessionEnabled("D", "late_rehab").enabled).toBe(true);
    expect(isCalibrationSessionEnabled("D", "return_to_sport").enabled).toBe(true);
    expect(isCalibrationSessionEnabled("D", "performance").enabled).toBe(true);
  });

  it("habilita siempre las sesiones A, B, C y 1RM_day", () => {
    for (const s of ["A", "B", "C", "1RM_day"] as const) {
      expect(isCalibrationSessionEnabled(s, "early_rehab").enabled).toBe(true);
    }
  });
});

describe("EXERCISE_CALIBRATION_MAP", () => {
  it("cubre los 33 ejercicios exactos de seed_programa_lca.json", () => {
    const seedPath = join(__dirname, "..", "seed_programa_lca.json");
    const seed = JSON.parse(readFileSync(seedPath, "utf-8")) as { exercises: { name: string }[] };
    const seedNames = seed.exercises.map((e) => e.name).sort();
    const mapNames = Object.keys(EXERCISE_CALIBRATION_MAP).sort();

    expect(seed.exercises.length).toBe(33);
    expect(mapNames).toEqual(seedNames);
  });
});

describe("CALIBRATION_SESSION_EXERCISES", () => {
  it("solo referencia ejercicios presentes en el mapa de calibración", () => {
    for (const exercises of Object.values(CALIBRATION_SESSION_EXERCISES)) {
      for (const name of exercises) {
        expect(EXERCISE_CALIBRATION_MAP[name]).toBeDefined();
      }
    }
  });
});
