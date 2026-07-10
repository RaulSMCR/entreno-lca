import { describe, expect, it } from "vitest";
import {
  BEAT_SECONDS_BY_OBJECTIVE,
  PRESCRIBED_REST_SECONDS,
  TEMPO_BY_OBJECTIVE,
  estimateTUTSeconds,
  getObjectiveFromSlot,
} from "./training-theory";

describe("getObjectiveFromSlot", () => {
  it("clasifica reps bajas + %max alto como fuerza", () => {
    expect(getObjectiveFromSlot({ reps: 3, pct_max: 90 }, "kg")).toBe("strength");
  });

  it("clasifica reps bajas + %max moderado como potencia", () => {
    expect(getObjectiveFromSlot({ reps: 5, pct_max: 60 }, "kg")).toBe("power");
  });

  it("clasifica reps medias como hipertrofia", () => {
    expect(getObjectiveFromSlot({ reps: 10, pct_max: 70 }, "kg")).toBe("hypertrophy");
  });

  it("clasifica reps altas como resistencia", () => {
    expect(getObjectiveFromSlot({ reps: 20 }, "kg")).toBe("endurance");
  });

  it("clasifica ejercicios sin carga (unit != kg) siempre como resistencia", () => {
    expect(getObjectiveFromSlot({ reps: 3, pct_max: 90 }, "seconds")).toBe("endurance");
  });

  it("usa 10 reps por defecto cuando reps es null", () => {
    expect(getObjectiveFromSlot({ reps: null, pct_max: null }, "kg")).toBe("hypertrophy");
  });
});

describe("estimateTUTSeconds", () => {
  it("multiplica sets * reps * duración de tempo por rep", () => {
    // hypertrophy: 3+1+2 = 6s por rep
    expect(estimateTUTSeconds(3, 10, "hypertrophy")).toBe(3 * 10 * 6);
  });
});

describe("tablas de constantes", () => {
  it("tienen una entrada por cada objetivo de entrenamiento", () => {
    const objectives = ["strength", "power", "hypertrophy", "endurance"] as const;
    for (const o of objectives) {
      expect(PRESCRIBED_REST_SECONDS[o]).toBeDefined();
      expect(TEMPO_BY_OBJECTIVE[o]).toBeDefined();
      expect(BEAT_SECONDS_BY_OBJECTIVE[o]).toBeGreaterThan(0);
    }
  });
});
