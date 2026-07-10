import { describe, expect, it } from "vitest";
import { buildRecommendation, detectSkipPatterns, type SkipRecord } from "./skip-patterns";

const exercise = { id: "ex-1", name: "Press de Banca" };

function record(overrides: Partial<SkipRecord>): SkipRecord {
  return {
    sessionId: overrides.sessionId ?? "s1",
    sessionDate: overrides.sessionDate ?? "2026-07-01",
    status: overrides.status ?? "completed",
    skipReason: overrides.skipReason ?? null,
    skipNote: null,
    setsCompleted: 3,
    setsPlanned: 3,
    ...overrides,
  };
}

describe("detectSkipPatterns", () => {
  it("no detecta nada con historial vacío", () => {
    expect(detectSkipPatterns([], exercise)).toEqual([]);
  });

  it("detecta recurring_station_busy con 2+ de las últimas 4 sesiones", () => {
    const history = [
      record({ sessionDate: "2026-07-04", status: "skipped", skipReason: "station_occupied" }),
      record({ sessionDate: "2026-07-03", status: "completed" }),
      record({ sessionDate: "2026-07-02", status: "skipped", skipReason: "station_occupied" }),
      record({ sessionDate: "2026-07-01", status: "completed" }),
    ];
    const patterns = detectSkipPatterns(history, exercise);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].type).toBe("recurring_station_busy");
    expect(patterns[0].severity).toBe("warning");
    expect(patterns[0].occurrences).toBe(2);
  });

  it("detecta chronic_partial con 3+ 'partial' de las últimas 4 sesiones", () => {
    const history = [
      record({ sessionDate: "2026-07-04", status: "partial" }),
      record({ sessionDate: "2026-07-03", status: "partial" }),
      record({ sessionDate: "2026-07-02", status: "partial" }),
      record({ sessionDate: "2026-07-01", status: "completed" }),
    ];
    const patterns = detectSkipPatterns(history, exercise);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].type).toBe("chronic_partial");
    expect(patterns[0].severity).toBe("info");
  });

  it("detecta physical_concern (critical) con molestia en las últimas 2 sesiones, antes que otras reglas", () => {
    const history = [
      record({ sessionDate: "2026-07-04", status: "skipped", skipReason: "physical_discomfort" }),
      record({ sessionDate: "2026-07-03", status: "skipped", skipReason: "station_occupied" }),
      record({ sessionDate: "2026-07-02", status: "skipped", skipReason: "station_occupied" }),
    ];
    const patterns = detectSkipPatterns(history, exercise);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].type).toBe("physical_concern");
    expect(patterns[0].severity).toBe("critical");
  });

  it("detecta recurring_skip genérico con 3+ de las últimas 6 (sin razón dominante)", () => {
    const history = [
      record({ sessionDate: "2026-07-06", status: "skipped", skipReason: "no_time" }),
      record({ sessionDate: "2026-07-05", status: "completed" }),
      record({ sessionDate: "2026-07-04", status: "partial" }),
      record({ sessionDate: "2026-07-03", status: "completed" }),
      record({ sessionDate: "2026-07-02", status: "skipped", skipReason: "other" }),
      record({ sessionDate: "2026-07-01", status: "completed" }),
    ];
    const patterns = detectSkipPatterns(history, exercise);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].type).toBe("recurring_skip");
  });

  it("no detecta nada por debajo de los umbrales", () => {
    const history = [
      record({ sessionDate: "2026-07-02", status: "skipped", skipReason: "station_occupied" }),
      record({ sessionDate: "2026-07-01", status: "completed" }),
    ];
    expect(detectSkipPatterns(history, exercise)).toEqual([]);
  });
});

describe("buildRecommendation", () => {
  it("genera título, body, acciones e impactNote para cada tipo de patrón", () => {
    const base = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      occurrences: 2,
      totalSessions: 4,
    };
    const types = [
      { type: "physical_concern" as const, reason: "physical_discomfort" as const, severity: "critical" as const },
      { type: "recurring_station_busy" as const, reason: "station_occupied" as const, severity: "warning" as const },
      { type: "recurring_equipment_issue" as const, reason: "equipment_unavailable" as const, severity: "warning" as const },
      { type: "chronic_partial" as const, reason: null, severity: "info" as const },
      { type: "recurring_skip" as const, reason: null, severity: "info" as const },
    ];

    for (const t of types) {
      const rec = buildRecommendation({ ...base, ...t });
      expect(rec.title.length).toBeGreaterThan(0);
      expect(rec.body).toContain(exercise.name);
      expect(rec.actions.length).toBeGreaterThan(0);
      expect(rec.impactNote.length).toBeGreaterThan(0);
    }
  });
});
