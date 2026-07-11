import { describe, expect, it } from "vitest";
import { getLoggingSchema } from "./exerciseLogging";

describe("getLoggingSchema", () => {
  it("fuerza_carga: carga + reps + rpe detallado, sin cronómetro ni observaciones", () => {
    const s = getLoggingSchema("fuerza_carga");
    expect(s.showLoad).toBe(true);
    expect(s.showReps).toBe(true);
    expect(s.showStopwatch).toBe(false);
    expect(s.showRpeAtRep).toBe(true);
    expect(s.showFailureCheckbox).toBe(true);
    expect(s.showNotes).toBe(false);
    expect(s.showSide).toBe(false);
    expect(s.showRomRpe).toBe(false);
  });

  it("isometria_tiempo: solo cronómetro, sin carga/reps/rpe detallado", () => {
    const s = getLoggingSchema("isometria_tiempo");
    expect(s.showStopwatch).toBe(true);
    expect(s.showLoad).toBe(false);
    expect(s.showReps).toBe(false);
    expect(s.showRpeAtRep).toBe(false);
    expect(s.showFailureCheckbox).toBe(false);
  });

  it("movilidad_repeticiones: reps + lado + ROM + observaciones, sin carga", () => {
    const s = getLoggingSchema("movilidad_repeticiones");
    expect(s.showReps).toBe(true);
    expect(s.showSide).toBe(true);
    expect(s.showRomRpe).toBe(true);
    expect(s.showNotes).toBe(true);
    expect(s.showLoad).toBe(false);
    expect(s.showStopwatch).toBe(false);
  });

  it("movilidad_tiempo: cronómetro + lado, sin carga ni ROM", () => {
    const s = getLoggingSchema("movilidad_tiempo");
    expect(s.showStopwatch).toBe(true);
    expect(s.showSide).toBe(true);
    expect(s.showRomRpe).toBe(false);
    expect(s.showLoad).toBe(false);
  });

  it("distancia_carga: carga manual + reps(metros) + postura", () => {
    const s = getLoggingSchema("distancia_carga");
    expect(s.showLoad).toBe(true);
    expect(s.showReps).toBe(true);
    expect(s.showPostureCheck).toBe(true);
    expect(s.showStopwatch).toBe(false);
  });

  it("potencia_tiempo_fijo: carga + reps + ventana fija de 20s", () => {
    const s = getLoggingSchema("potencia_tiempo_fijo");
    expect(s.showLoad).toBe(true);
    expect(s.showReps).toBe(true);
    expect(s.fixedWindowSeconds).toBe(20);
  });

  it("cardio_intervalos: no consume esta config (va por CardioSetRow)", () => {
    const s = getLoggingSchema("cardio_intervalos");
    expect(s.purpose).toBe("cardio_intervalos");
    expect(s.showLoad).toBe(false);
    expect(s.showReps).toBe(false);
  });

  it("purpose desconocido cae en fuerza_carga por defecto", () => {
    expect(getLoggingSchema("algo_no_definido")).toEqual(getLoggingSchema("fuerza_carga"));
  });
});
