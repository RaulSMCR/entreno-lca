import { describe, expect, it } from "vitest";
import { computeSessionCompletion, type SessionExerciseStatus } from "./session-exercise";

function status(overrides: Partial<SessionExerciseStatus>): SessionExerciseStatus {
  return {
    id: overrides.id ?? "s1",
    created_at: "",
    updated_at: "",
    user_id: "u1",
    session_id: "sess-1",
    exercise_id: overrides.exercise_id ?? "ex-1",
    template_slot_id: null,
    status: overrides.status ?? "pending",
    skip_reason: overrides.skip_reason ?? null,
    skip_note: null,
    sets_planned: 3,
    sets_completed: 0,
    execution_order: null,
    started_at: null,
    completed_at: null,
    actual_duration_seconds: null,
    _dirty: 0,
    _deleted: 0,
    ...overrides,
  };
}

describe("computeSessionCompletion", () => {
  it("cuenta cada estado y calcula las tasas de finalización", () => {
    const statuses: SessionExerciseStatus[] = [
      status({ id: "1", exercise_id: "a", status: "completed" }),
      status({ id: "2", exercise_id: "b", status: "completed" }),
      status({ id: "3", exercise_id: "c", status: "partial" }),
      status({ id: "4", exercise_id: "d", status: "skipped", skip_reason: "station_occupied" }),
      status({ id: "5", exercise_id: "e", status: "skipped", skip_reason: "station_occupied" }),
      status({ id: "6", exercise_id: "f", status: "pending" }),
    ];

    const result = computeSessionCompletion(statuses);
    expect(result.total).toBe(6);
    expect(result.completed).toBe(2);
    expect(result.partial).toBe(1);
    expect(result.skipped).toBe(2);
    expect(result.pending).toBe(1);
    expect(result.completionRate).toBeCloseTo(3 / 6, 5);
    expect(result.fullCompletionRate).toBeCloseTo(2 / 6, 5);
    expect(result.skippedByReason.station_occupied).toBe(2);
    expect(result.skippedByReason.physical_discomfort).toBe(0);
  });

  it("devuelve ceros con un array vacío, sin dividir por cero", () => {
    const result = computeSessionCompletion([]);
    expect(result.total).toBe(0);
    expect(result.completionRate).toBe(0);
    expect(result.fullCompletionRate).toBe(0);
  });
});
