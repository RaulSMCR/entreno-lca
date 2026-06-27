import { describe, expect, it } from "vitest";
import { buildHistoryRows, rowsToCsv } from "./export";

describe("buildHistoryRows", () => {
  it("resuelve fecha de sesión y nombre de ejercicio, y ordena por fecha/ejercicio/serie", () => {
    const rows = buildHistoryRows(
      [
        { session_id: "s2", exercise_id: "e1", set_number: 1, actual_load_kg: 60, actual_reps: 5, rpe_reported: 8, is_failure: false },
        { session_id: "s1", exercise_id: "e1", set_number: 2, actual_load_kg: 65, actual_reps: 4, rpe_reported: 9, is_failure: false },
        { session_id: "s1", exercise_id: "e1", set_number: 1, actual_load_kg: 65, actual_reps: 5, rpe_reported: 8, is_failure: false },
      ],
      { s1: "2026-01-01", s2: "2026-01-08" },
      { e1: "Press banca" }
    );
    expect(rows.map((r) => [r.date, r.set_number])).toEqual([
      ["2026-01-01", 1],
      ["2026-01-01", 2],
      ["2026-01-08", 1],
    ]);
    expect(rows[0].exercise).toBe("Press banca");
  });
});

describe("rowsToCsv", () => {
  it("sin filas, devuelve string vacío", () => {
    expect(rowsToCsv([])).toBe("");
  });

  it("genera encabezado y filas separadas por coma", () => {
    const csv = rowsToCsv([
      { date: "2026-01-01", exercise: "Press banca", set_number: 1, load_kg: 60, reps: 5, rpe: 8, is_failure: false },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("date,exercise,set_number,load_kg,reps,rpe,is_failure");
    expect(lines[1]).toBe("2026-01-01,Press banca,1,60,5,8,false");
  });

  it("escapa comas y comillas en valores de texto", () => {
    const csv = rowsToCsv([
      { date: "2026-01-01", exercise: 'Remo "ancho", agarre cerrado', set_number: 1, load_kg: 40, reps: 8, rpe: 7, is_failure: false },
    ]);
    expect(csv.split("\n")[1]).toBe('2026-01-01,"Remo ""ancho"", agarre cerrado",1,40,8,7,false');
  });
});
