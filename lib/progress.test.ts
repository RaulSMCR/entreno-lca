import { describe, expect, it } from "vitest";
import {
  averageRpePerSession,
  deloadSuggestion,
  isChronicHighRpe,
  isStagnant,
  projectE1rm,
  rpeDistribution,
  weeklyVolume,
  weeklyVolumeSeries,
} from "./progress";

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

describe("isChronicHighRpe", () => {
  it("sin suficientes sesiones, no alerta", () => {
    expect(isChronicHighRpe([9, 9], 3)).toBe(false);
  });

  it("últimas n sesiones todas en o por encima del umbral -> true", () => {
    expect(isChronicHighRpe([7, 9, 9.5, 9], 3, 9)).toBe(true);
  });

  it("alguna sesión reciente por debajo del umbral -> false", () => {
    expect(isChronicHighRpe([9, 9, 8, 9], 3, 9)).toBe(false);
  });
});

describe("deloadSuggestion", () => {
  it("sin estancamiento ni RPE alto, no sugiere deload", () => {
    const history = [
      { date: "2026-01-01", e1rm: 100 },
      { date: "2026-01-08", e1rm: 103 },
      { date: "2026-01-15", e1rm: 106 },
    ];
    expect(deloadSuggestion(history, [7, 7.5, 8]).suggested).toBe(false);
  });

  it("estancamiento sólo, sugiere deload por esa razón", () => {
    const history = [
      { date: "2026-01-01", e1rm: 100 },
      { date: "2026-01-08", e1rm: 105 },
      { date: "2026-01-15", e1rm: 103 },
      { date: "2026-01-22", e1rm: 102 },
      { date: "2026-01-29", e1rm: 104 },
      { date: "2026-02-05", e1rm: 103 },
    ];
    const result = deloadSuggestion(history, [7, 7, 7]);
    expect(result.suggested).toBe(true);
    expect(result.reasons).toEqual(["stagnation"]);
  });

  it("RPE crónicamente alto sólo, sugiere deload por esa razón", () => {
    const history = [
      { date: "2026-01-01", e1rm: 100 },
      { date: "2026-01-08", e1rm: 103 },
    ];
    const result = deloadSuggestion(history, [9, 9.5, 9]);
    expect(result.suggested).toBe(true);
    expect(result.reasons).toEqual(["chronic_high_rpe"]);
  });
});

describe("weeklyVolumeSeries", () => {
  it("agrupa por semana (lunes a domingo) y ordena ascendente", () => {
    const series = weeklyVolumeSeries([
      { load: 100, reps: 5, date: "2026-01-05" }, // lunes
      { load: 100, reps: 5, date: "2026-01-07" }, // misma semana
      { load: 50, reps: 10, date: "2026-01-12" }, // semana siguiente
    ]);
    expect(series).toEqual([
      { weekStart: "2026-01-05", totalKg: 1000 },
      { weekStart: "2026-01-12", totalKg: 500 },
    ]);
  });

  it("recorta a las últimas N semanas con datos", () => {
    const sets = Array.from({ length: 10 }, (_, i) => ({
      load: 10,
      reps: 1,
      date: `2026-${String(1 + Math.floor((i * 7) / 30)).padStart(2, "0")}-${String(1 + ((i * 7) % 28)).padStart(2, "0")}`,
    }));
    expect(weeklyVolumeSeries(sets, 3).length).toBeLessThanOrEqual(3);
  });
});

describe("rpeDistribution", () => {
  it("cuenta ocurrencias por valor de RPE, ordenado ascendente", () => {
    expect(rpeDistribution([8, 7, 8, 9, 7, 8])).toEqual([
      { rpe: 7, count: 2 },
      { rpe: 8, count: 3 },
      { rpe: 9, count: 1 },
    ]);
  });

  it("sin datos, devuelve array vacío", () => {
    expect(rpeDistribution([])).toEqual([]);
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
