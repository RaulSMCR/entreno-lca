import { describe, expect, it } from "vitest";
import {
  e1rmFromSet,
  suggestNextLoad,
  suggestNextTarget,
  targetLoad,
  updateE1rm,
} from "./engine";
import type { EquipmentLoadConfig } from "./loads";

const barbell: EquipmentLoadConfig = {
  load_mode: "barbell",
  bar_kg: 20,
  plate_pairs: [1.25, 2.5, 5, 10, 20],
};

describe("e1rmFromSet", () => {
  it("da un valor coherente para 100kg x 5 @ RPE 8", () => {
    // RIR = 10-8 = 2 -> repsToFailure = 7 -> Epley: 100*(1+7/30) ≈ 123.3kg.
    // (La nota del prompt original decía "~117kg", que es el Epley clásico sobre
    // las 5 reps reportadas sin ajuste por RPE; acá sí lo ajustamos por RIR como
    // pide el algoritmo descripto, así que el resultado de referencia es ~123kg.)
    expect(e1rmFromSet({ load: 100, reps: 5, rpe: 8 })).toBeCloseTo(123.33, 1);
  });

  it("a RPE 10 (fallo), repsToFailure = reps reportadas", () => {
    expect(e1rmFromSet({ load: 100, reps: 5, rpe: 10 })).toBeCloseTo(116.67, 1);
  });
});

describe("targetLoad", () => {
  it("calcula la carga ideal y la snappea hacia abajo por defecto", () => {
    const result = targetLoad(100, 85, barbell);
    expect(result.ideal).toBe(85);
    expect(result.real).toBe(85); // 85 es alcanzable exacto con esta barra
    expect(result.delta).toBe(0);
  });

  it("recalcula automáticamente al cambiar el e1RM (sin caché ni columna almacenada)", () => {
    const lunes = targetLoad(100, 80, barbell); // día A: 80%
    const jueves = targetLoad(100, 70, barbell); // día B: 70%
    expect(lunes.real).toBe(80);
    expect(jueves.real).toBe(70);

    // Subió el e1RM del ejercicio a 110 -> ambos días reflejan el nuevo valor
    // sin tocar ninguna fila guardada, porque targetLoad siempre recibe el
    // e1RM vigente como parámetro.
    const lunesActualizado = targetLoad(110, 80, barbell);
    const juevesActualizado = targetLoad(110, 70, barbell);
    expect(lunesActualizado.real).toBeGreaterThan(lunes.real);
    expect(juevesActualizado.real).toBeGreaterThan(jueves.real);
  });
});

describe("updateE1rm", () => {
  it("sube el e1RM si la mejor serie lo supera, respetando el tope de subida", () => {
    const result = updateE1rm({ e1rm_kg: 100 }, [{ load: 100, reps: 5, rpe: 8 }], { maxIncreasePct: 8 });
    // bestSetE1rm ~123.3, pero el tope es 100*1.08 = 108
    expect(result.updated).toBe(true);
    expect(result.bestSetE1rm).toBeCloseTo(123.33, 1);
    expect(result.e1rm).toBeCloseTo(108, 1);
  });

  it("no baja el e1RM si la sesión fue floja", () => {
    const result = updateE1rm({ e1rm_kg: 100 }, [{ load: 60, reps: 5, rpe: 9 }]);
    expect(result.updated).toBe(false);
    expect(result.e1rm).toBe(100);
  });

  it("sin tope previo (e1RM null), toma la mejor serie directamente", () => {
    const result = updateE1rm({ e1rm_kg: null }, [{ load: 50, reps: 5, rpe: 8 }]);
    expect(result.updated).toBe(true);
    expect(result.e1rm).toBeCloseTo(result.bestSetE1rm, 5);
  });
});

describe("suggestNextLoad", () => {
  const baseInput = { target_reps: 5, target_rpe: 8 };

  it("camino 1: cumplió reps con RPE <= objetivo -> increase", () => {
    const result = suggestNextLoad(
      { ...baseInput, last_session_sets: [{ load: 75, reps: 5, rpe: 7.5 }] },
      barbell
    );
    expect(result.action).toBe("increase");
    expect(result.real).toBeGreaterThan(75);
  });

  it("camino 2: cumplió reps pero con RPE > objetivo -> maintain", () => {
    const result = suggestNextLoad(
      { ...baseInput, last_session_sets: [{ load: 75, reps: 5, rpe: 9.5 }] },
      barbell
    );
    expect(result.action).toBe("maintain");
    expect(result.real).toBe(75);
  });

  it("camino 3a: se quedó corto por poco y no llegó al fallo -> repeat", () => {
    const result = suggestNextLoad(
      { ...baseInput, last_session_sets: [{ load: 75, reps: 4, rpe: 9 }] },
      barbell
    );
    expect(result.action).toBe("repeat");
    expect(result.real).toBe(75);
  });

  it("camino 3b: se quedó muy corto / RPE de fallo -> decrease", () => {
    const result = suggestNextLoad(
      { ...baseInput, last_session_sets: [{ load: 75, reps: 2, rpe: 10 }] },
      barbell
    );
    expect(result.action).toBe("decrease");
    expect(result.real).toBeLessThan(75);
  });

  it("sin escalón disponible hacia arriba, recomienda +e1RM sin snappear", () => {
    const topped: EquipmentLoadConfig = { load_mode: "list", available_loads: [75] };
    const result = suggestNextLoad(
      { ...baseInput, last_session_sets: [{ load: 75, reps: 5, rpe: 7 }] },
      topped
    );
    expect(result.action).toBe("increase");
    expect(result.real).toBeGreaterThan(75);
  });
});

describe("suggestNextTarget (ejercicios sin carga)", () => {
  it("sin historial, no hay PR ni objetivo", () => {
    expect(suggestNextTarget([])).toEqual({ target: 0, isPR: false });
  });

  it("la última marca bate al histórico -> PR", () => {
    const result = suggestNextTarget([30, 35, 32, 40]);
    expect(result.isPR).toBe(true);
    expect(result.target).toBe(40);
  });

  it("la última marca no bate al histórico -> sin PR, objetivo es el mejor previo", () => {
    const result = suggestNextTarget([30, 45, 32, 40]);
    expect(result.isPR).toBe(false);
    expect(result.target).toBe(45);
  });
});
