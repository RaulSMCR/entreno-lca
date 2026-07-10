import { describe, expect, it } from "vitest";
import {
  SESSION_BUFFERS,
  estimateSessionTime,
  formatDuration,
  formatEstimateSummary,
  getSessionProgress,
  type SlotWithExercise,
} from "./session-time";

function slot(overrides: Partial<SlotWithExercise> & { exercise: Partial<SlotWithExercise["exercise"]> }): SlotWithExercise {
  const exercise = {
    id: overrides.exercise.id ?? "ex-1",
    name: overrides.exercise.name ?? "Ejercicio",
    unit: overrides.exercise.unit ?? "kg",
    block: overrides.exercise.block ?? "principal",
    category: null,
    biomech_note: null,
    equipment_id: null,
    e1rm_kg: null,
    rm_base_kg: null,
    is_active: true,
    created_at: "",
    updated_at: "",
    user_id: "u1",
    _dirty: 0 as const,
    _deleted: 0 as const,
    equipment: overrides.exercise.equipment ?? undefined,
  };

  return {
    id: overrides.id ?? `slot-${exercise.id}`,
    day_template_id: "dt-1",
    slot_order: overrides.slot_order ?? 0,
    block: exercise.block,
    exercise_id: exercise.id,
    sets: overrides.sets ?? 4,
    reps: overrides.reps ?? 5,
    pct_max: overrides.pct_max ?? 85,
    rpe_target: overrides.rpe_target ?? null,
    reps_or_time: overrides.reps_or_time ?? null,
    intensity_note: null,
    scheme_raw: null,
    created_at: "",
    updated_at: "",
    user_id: "u1",
    _dirty: 0,
    _deleted: 0,
    exercise,
  } as SlotWithExercise;
}

function equipment(type: string) {
  return {
    id: `eq-${type}`,
    name: type,
    type,
    load_mode: "range",
    available_loads: null,
    bar_kg: null,
    max_kg: null,
    micro_plates: null,
    min_kg: null,
    plate_pairs: null,
    step_kg: null,
    created_at: "",
    updated_at: "",
    user_id: "u1",
    _dirty: 0 as const,
    _deleted: 0 as const,
  };
}

const typicalSession: SlotWithExercise[] = [
  slot({
    slot_order: 0,
    sets: 4,
    reps: 5,
    pct_max: 85,
    exercise: { id: "sentadilla", name: "Sentadilla", unit: "kg", block: "principal", equipment: equipment("barbell") },
  }),
  slot({
    slot_order: 1,
    sets: 4,
    reps: 5,
    pct_max: 80,
    exercise: { id: "press-banca", name: "Press de Banca", unit: "kg", block: "principal", equipment: equipment("barbell") },
  }),
  slot({
    slot_order: 2,
    sets: 3,
    reps: 10,
    pct_max: 70,
    exercise: { id: "remo", name: "Remo con Mancuerna", unit: "kg", block: "principal", equipment: equipment("free_weight") },
  }),
  slot({
    slot_order: 3,
    sets: 3,
    reps: 12,
    pct_max: null,
    exercise: { id: "extension", name: "Extensión de Cuádriceps", unit: "kg", block: "secundario", equipment: equipment("machine") },
  }),
  slot({
    slot_order: 4,
    sets: 3,
    reps: 15,
    pct_max: null,
    exercise: { id: "polea", name: "Jalón en Polea", unit: "kg", block: "secundario", equipment: equipment("cable_stack") },
  }),
  slot({
    slot_order: 5,
    sets: 3,
    reps: null,
    pct_max: null,
    reps_or_time: "45s",
    exercise: { id: "plancha", name: "Plancha", unit: "seconds", block: "secundario", equipment: equipment("bodyweight") },
  }),
];

describe("estimateSessionTime", () => {
  it("estima entre 40 y 75 minutos para una sesión típica de 6 ejercicios", () => {
    const estimate = estimateSessionTime(typicalSession);
    expect(estimate.estimatedMinutes).toBeGreaterThanOrEqual(40);
    expect(estimate.estimatedMinutes).toBeLessThanOrEqual(75);
  });

  it("suma los segundos parciales al total correctamente", () => {
    const estimate = estimateSessionTime(typicalSession);
    const sumOfExerciseTotals = estimate.exercises.reduce((a, e) => a + e.totalSeconds, 0);
    expect(estimate.estimatedTotalSeconds).toBe(estimate.warmupSeconds + sumOfExerciseTotals);

    for (const e of estimate.exercises) {
      expect(e.totalSeconds).toBe(e.setupSeconds + e.workSeconds + e.restSeconds + e.countdownSeconds);
    }
  });

  it("solo suma el buffer de lectura de técnica al primer ejercicio", () => {
    const estimate = estimateSessionTime(typicalSession);
    const firstEquipmentSeconds = 120; // barbell
    expect(estimate.exercises[0].setupSeconds).toBe(firstEquipmentSeconds + SESSION_BUFFERS.technique_reading_first);
    expect(estimate.exercises[1].setupSeconds).toBe(120); // barbell, sin buffer de técnica
  });

  it("no cuenta descanso tras la última serie (N-1 descansos)", () => {
    const oneExercise = estimateSessionTime([typicalSession[0]]);
    // 4 sets -> 3 intervalos de descanso
    const objective = oneExercise.exercises[0].objective;
    expect(objective).toBe("strength");
  });

  it("formatDuration y formatEstimateSummary devuelven strings legibles", () => {
    expect(formatDuration(30)).toBe("menos de 1 minuto");
    expect(formatDuration(125)).toBe("2 minutos");
    expect(formatDuration(3900)).toBe("1h 5m");

    const estimate = estimateSessionTime(typicalSession);
    const summary = formatEstimateSummary(estimate);
    expect(summary).toContain("min trabajo");
    expect(summary).toContain("min descanso");
    expect(summary).toContain("min traslados");
    expect(summary).toContain(`~${estimate.estimatedMinutes} min total`);
  });
});

describe("getSessionProgress", () => {
  it("devuelve el desvío correcto comparando elapsed vs expected_elapsed", () => {
    const estimate = estimateSessionTime(typicalSession);
    const start = new Date("2026-07-10T10:00:00Z");
    const completedIds = [typicalSession[0].exercise_id, typicalSession[1].exercise_id];
    const expectedElapsedSoFar =
      estimate.warmupSeconds + estimate.exercises[0].totalSeconds + estimate.exercises[1].totalSeconds;

    // "now" = exactamente el tiempo esperado -> desvío 0
    const onTime = new Date(start.getTime() + expectedElapsedSoFar * 1000);
    const progressOnTime = getSessionProgress(estimate, completedIds, [], start, onTime);
    expect(progressOnTime.deviationSeconds).toBe(0);
    expect(progressOnTime.isAheadOfSchedule).toBe(false);

    // "now" = 60s antes de lo esperado -> vamos adelantados (deviation positivo)
    const early = new Date(start.getTime() + (expectedElapsedSoFar - 60) * 1000);
    const progressEarly = getSessionProgress(estimate, completedIds, [], start, early);
    expect(progressEarly.deviationSeconds).toBe(60);
    expect(progressEarly.isAheadOfSchedule).toBe(true);

    // "now" = 60s después de lo esperado -> vamos atrasados (deviation negativo)
    const late = new Date(start.getTime() + (expectedElapsedSoFar + 60) * 1000);
    const progressLate = getSessionProgress(estimate, completedIds, [], start, late);
    expect(progressLate.deviationSeconds).toBe(-60);
    expect(progressLate.isAheadOfSchedule).toBe(false);
  });

  it("recalcula el estimado ajustado excluyendo ejercicios saltados", () => {
    const estimate = estimateSessionTime(typicalSession);
    const start = new Date();
    const skippedId = typicalSession[5].exercise_id;
    const progress = getSessionProgress(estimate, [], [skippedId], start, start);
    const withoutSkipped =
      estimate.warmupSeconds + estimate.exercises.filter((e) => e.exerciseId !== skippedId).reduce((a, e) => a + e.totalSeconds, 0);
    expect(progress.adjustedEstimatedMinutes).toBe(Math.ceil(withoutSkipped / 60));
    expect(progress.adjustedEstimatedMinutes).toBeLessThan(estimate.estimatedMinutes);
  });

  it("percentComplete refleja ejercicios completados+saltados sobre el total", () => {
    const estimate = estimateSessionTime(typicalSession);
    const start = new Date();
    const progress = getSessionProgress(
      estimate,
      [typicalSession[0].exercise_id, typicalSession[1].exercise_id],
      [typicalSession[2].exercise_id],
      start,
      start
    );
    expect(progress.percentComplete).toBeCloseTo(3 / 6, 5);
  });
});
