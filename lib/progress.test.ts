import { describe, expect, it } from "vitest";
import { averageRpePerSession, isStagnant, projectE1rm, weeklyVolume } from "./progress";

describe("projectE1rm", () => {
  it("sin historial suficiente, no proyecta", () => {
    expect(projectE1rm([])).toBeNull();
    expect(projectE1rm([{ date: "2026-01-01", e1rm: 100 }])).toBeNull();
  });

  it("extiende la recta del ritmo reciente a 4 semanas", () => {
    // +1kg cada 7 días -> en 4 semanas (28 días) suma 4kg sobre el último valor (101)
    const history = [
      { date: "2026-01-01", e1rm: 100 },
      { date: "2026-01-08", e1rm: 101 },
    ];
    expect(projectE1rm(history, 4)).toBeCloseTo(105, 1);
  });

  it("ritmo nulo o negativo no rompe, solo no proyecta mejora", () => {
    const history = [
      { date: "2026-01-01", e1rm: 100 },
      { date: "2026-01-08", e1rm: 95 },
    ];
    expect(projectE1rm(history, 4)).toBeLessThan(95);
  });
});

describe("isStagnant", () => {
  it("sin suficientes puntos, no hay alerta", () => {
    expect(isStagnant([{ date: "2026-01-01", e1rm: 100 }], 4)).toBe(false);
  });

  it("detecta estancamiento si no hay mejora en las últimas n estimaciones", () => {
    // el pico (105) quedó antes de la ventana de las últimas 4 estimaciones
    const history = [
      { date: "2026-01-01", e1rm: 100 },
      { date: "2026-01-08", e1rm: 105 },
      { date: "2026-01-15", e1rm: 103 },
      { date: "2026-01-22", e1rm: 102 },
      { date: "2026-01-29", e1rm: 104 },
      { date: "2026-02-05", e1rm: 103 },
    ];
    expect(isStagnant(history, 4)).toBe(true);
  });

  it("no alerta si hubo un nuevo máximo dentro de la ventana", () => {
    const history = [
      { date: "2026-01-01", e1rm: 100 },
      { date: "2026-01-08", e1rm: 101 },
      { date: "2026-01-15", e1rm: 103 },
      { date: "2026-01-22", e1rm: 106 },
      { date: "2026-01-29", e1rm: 108 },
    ];
    expect(isStagnant(history, 4)).toBe(false);
  });
});

describe("weeklyVolume", () => {
  it("suma carga x reps, ignorando sets sin carga (no-kg)", () => {
    const volume = weeklyVolume([
      { load: 100, reps: 5 },
      { load: 100, reps: 5 },
      { load: null, reps: 30 }, // ej. plancha en segundos, no aporta volumen en kg
    ]);
    expect(volume).toBe(1000);
  });
});

describe("averageRpePerSession", () => {
  it("agrupa por sesión y ordena por fecha descendente", () => {
    const result = averageRpePerSession(
      [
        { session_id: "s1", rpe_reported: 8 },
        { session_id: "s1", rpe_reported: 9 },
        { session_id: "s2", rpe_reported: 7 },
        { session_id: "s2", rpe_reported: null },
      ],
      { s1: "2026-01-01", s2: "2026-01-08" }
    );
    expect(result).toEqual([
      { sessionId: "s2", date: "2026-01-08", avgRpe: 7 },
      { sessionId: "s1", date: "2026-01-01", avgRpe: 8.5 },
    ]);
  });
});
