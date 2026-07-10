import { describe, expect, it } from "vitest";
import { evaluateStrengthLevel, getStrengthStandard } from "./strength-standards";

describe("getStrengthStandard", () => {
  it("matchea por substring case-insensitive", () => {
    expect(getStrengthStandard("Press de Banca Plano (Barra)")?.exerciseName).toBe("Press de Banca Plano");
    expect(getStrengthStandard("Dominadas Lastradas (Pull-up)")?.exerciseName).toBe("Dominadas Lastradas");
  });

  it("devuelve null si no hay estándar (ej. sentadilla, no está en el programa)", () => {
    expect(getStrengthStandard("Sentadilla Trasera")).toBeNull();
  });
});

describe("evaluateStrengthLevel", () => {
  const benchStandard = getStrengthStandard("Press de Banca Plano (Barra)")!;

  it("evaluateStrengthLevel(80, 80, bench, male) devuelve intermedio", () => {
    const result = evaluateStrengthLevel(80, 80, benchStandard, "male");
    expect(result.currentLevel).toBe("intermedio");
    expect(result.ratio).toBe(1);
  });

  it("clasifica por debajo de principiante", () => {
    const result = evaluateStrengthLevel(20, 80, benchStandard, "male");
    expect(result.currentLevel).toBe("below_principiante");
    expect(result.nextLevel).toBe("principiante");
  });

  it("clasifica elite sin próximo nivel", () => {
    const result = evaluateStrengthLevel(200, 80, benchStandard, "male");
    expect(result.currentLevel).toBe("elite");
    expect(result.nextLevel).toBeNull();
  });
});
