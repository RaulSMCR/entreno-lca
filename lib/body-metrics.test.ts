import { describe, expect, it } from "vitest";
import {
  calculateAge,
  calculateBMI,
  calculateLSI,
  getLSIInterpretation,
  getRollingAverageWeight,
  getWeightTrend,
} from "./body-metrics";

describe("calculateAge", () => {
  it("calcula edad cumplida contra una fecha de referencia", () => {
    expect(calculateAge("1990-07-15", new Date("2026-07-10"))).toBe(35);
    expect(calculateAge("1990-07-01", new Date("2026-07-10"))).toBe(36);
  });
});

describe("calculateBMI", () => {
  it("calcula peso / estatura^2 en metros", () => {
    expect(calculateBMI(70, 175)).toBeCloseTo(22.86, 2);
  });
});

describe("calculateLSI", () => {
  it("calcula el ratio pierna débil / pierna fuerte como porcentaje", () => {
    expect(calculateLSI(85, 100)).toBe(85);
  });
});

describe("getLSIInterpretation", () => {
  it("clasifica 85 como deficit_leve", () => {
    expect(getLSIInterpretation(85).level).toBe("deficit_leve");
  });

  it("clasifica >= 90 como simetria", () => {
    expect(getLSIInterpretation(90).level).toBe("simetria");
  });

  it("clasifica < 70 como deficit_severo", () => {
    expect(getLSIInterpretation(65).level).toBe("deficit_severo");
  });

  it("clasifica 70-80 como deficit_moderado", () => {
    expect(getLSIInterpretation(75).level).toBe("deficit_moderado");
  });
});

describe("getRollingAverageWeight", () => {
  it("devuelve null con menos de 3 registros en la ventana", () => {
    const logs = [
      { logged_at: new Date().toISOString(), weight_kg: 80 },
      { logged_at: new Date().toISOString(), weight_kg: 81 },
    ];
    expect(getRollingAverageWeight(logs, 7)).toBeNull();
  });

  it("promedia los registros dentro de la ventana", () => {
    const now = Date.now();
    const logs = [
      { logged_at: new Date(now).toISOString(), weight_kg: 80 },
      { logged_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(), weight_kg: 81 },
      { logged_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), weight_kg: 79 },
    ];
    expect(getRollingAverageWeight(logs, 7)).toBeCloseTo(80, 5);
  });
});

describe("getWeightTrend", () => {
  it("devuelve insufficient_data con menos de 2 registros", () => {
    const logs = [{ logged_at: new Date().toISOString(), weight_kg: 80 }];
    expect(getWeightTrend(logs).direction).toBe("insufficient_data");
  });

  it("clasifica como stable si el delta es menor a 0.3 kg/semana", () => {
    const now = Date.now();
    const logs = [
      { logged_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(), weight_kg: 80 },
      { logged_at: new Date(now).toISOString(), weight_kg: 80.1 },
    ];
    expect(getWeightTrend(logs).direction).toBe("stable");
  });

  it("clasifica como up si el peso sube por encima del umbral", () => {
    const now = Date.now();
    const logs = [
      { logged_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(), weight_kg: 80 },
      { logged_at: new Date(now).toISOString(), weight_kg: 81 },
    ];
    expect(getWeightTrend(logs).direction).toBe("up");
  });
});
