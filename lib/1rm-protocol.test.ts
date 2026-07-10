import { describe, expect, it } from "vitest";
import { buildProtocolPhases, getDeterminedE1RM, getNextAttempt, type ProtocolAttempt } from "./1rm-protocol";

const ctx = { exercise: { name: "Press de Banca Plano (Barra)" }, current_e1rm_kg: 100 };

describe("buildProtocolPhases", () => {
  it("arma las 3 fases de calentamiento fijas + el primer intento", () => {
    const phases = buildProtocolPhases(ctx);
    expect(phases).toHaveLength(4);

    expect(phases[0]).toMatchObject({ kind: "warmup", pctOfE1rm: 50, reps: 8, restSeconds: 60, targetLoadKg: 50 });
    expect(phases[1]).toMatchObject({ kind: "warmup", pctOfE1rm: 70, reps: 5, restSeconds: 120, targetLoadKg: 70 });
    expect(phases[2]).toMatchObject({ kind: "warmup", pctOfE1rm: 85, reps: 2, restSeconds: 180, targetLoadKg: 85 });
    expect(phases[3]).toMatchObject({ kind: "attempt", pctOfE1rm: 94, reps: 1, restSeconds: 240, targetLoadKg: 94 });
  });
});

describe("getNextAttempt", () => {
  it("sube 5% tras un intento exitoso", () => {
    const attempts: ProtocolAttempt[] = [{ pctOfE1rm: 94, loadKg: 94, success: true }];
    const result = getNextAttempt(attempts, ctx);
    expect(result.done).toBe(false);
    if (!result.done) expect(result.attempt.pctOfE1rm).toBe(99);
  });

  it("baja 2.5% tras un intento fallido", () => {
    const attempts: ProtocolAttempt[] = [{ pctOfE1rm: 94, loadKg: 94, success: false }];
    const result = getNextAttempt(attempts, ctx);
    expect(result.done).toBe(false);
    if (!result.done) expect(result.attempt.pctOfE1rm).toBe(91.5);
  });

  it("termina con 3 éxitos", () => {
    const attempts: ProtocolAttempt[] = [
      { pctOfE1rm: 94, loadKg: 94, success: true },
      { pctOfE1rm: 99, loadKg: 99, success: true },
      { pctOfE1rm: 104, loadKg: 104, success: true },
    ];
    const result = getNextAttempt(attempts, ctx);
    expect(result).toEqual({ done: true, reason: "three_successes" });
  });

  it("termina si el mismo peso falla 2 veces", () => {
    const attempts: ProtocolAttempt[] = [
      { pctOfE1rm: 94, loadKg: 94, success: false },
      { pctOfE1rm: 91.5, loadKg: 94, success: false }, // colisión de snap: misma carga real
    ];
    const result = getNextAttempt(attempts, ctx);
    expect(result).toEqual({ done: true, reason: "same_weight_failed_twice" });
  });

  it("termina a los 5 intentos totales", () => {
    const attempts: ProtocolAttempt[] = [
      { pctOfE1rm: 94, loadKg: 94, success: true },
      { pctOfE1rm: 99, loadKg: 99, success: false },
      { pctOfE1rm: 96.5, loadKg: 96.5, success: true },
      { pctOfE1rm: 101.5, loadKg: 101.5, success: false },
      { pctOfE1rm: 99, loadKg: 97, success: false },
    ];
    const result = getNextAttempt(attempts, ctx);
    expect(result).toEqual({ done: true, reason: "max_attempts_reached" });
  });
});

describe("getDeterminedE1RM", () => {
  it("devuelve la mayor carga exitosa", () => {
    const attempts: ProtocolAttempt[] = [
      { pctOfE1rm: 94, loadKg: 94, success: true },
      { pctOfE1rm: 99, loadKg: 99, success: true },
      { pctOfE1rm: 104, loadKg: 104, success: false },
    ];
    expect(getDeterminedE1RM(attempts)).toBe(99);
  });

  it("devuelve null si ningún intento tuvo éxito", () => {
    const attempts: ProtocolAttempt[] = [{ pctOfE1rm: 94, loadKg: 94, success: false }];
    expect(getDeterminedE1RM(attempts)).toBeNull();
  });
});
