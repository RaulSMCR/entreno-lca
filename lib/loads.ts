// Resolución de cargas reales para un equipo (mancuernas/máquina con pesos fijos,
// equipo con rango continuo, o barra + discos). Solo aplica a ejercicios con
// unit === 'kg'; el caller decide si corresponde llamar a esto.

export type LoadMode = "list" | "range" | "barbell";

export type EquipmentLoadConfig = {
  load_mode: LoadMode;
  available_loads?: number[] | null;
  min_kg?: number | null;
  max_kg?: number | null;
  step_kg?: number | null;
  bar_kg?: number | null;
  plate_pairs?: number[] | null;
  micro_plates?: number[] | null;
};

export type SnapResult = {
  /** Carga real más cercana (o inmediata inferior) disponible en el equipo. */
  real: number;
  /** true si la carga ideal no era una carga real disponible. */
  rounded: boolean;
  /** real - ideal (con signo). */
  delta: number;
};

const resolveCache = new Map<string, number[]>();

function rangeLoads(min: number, max: number, step: number): number[] {
  if (step <= 0 || max < min) return [];
  const loads: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) {
    loads.push(Math.round(v * 100) / 100);
  }
  return loads;
}

// Combina bar_kg con todas las combinaciones de discos disponibles (cada par usado
// como máximo una vez, ya que el esquema solo guarda denominaciones, no cantidades).
function barbellLoads(barKg: number, pairs: number[]): number[] {
  const totals = new Set<number>([barKg]);
  for (const pair of pairs) {
    for (const total of Array.from(totals)) {
      totals.add(Math.round((total + 2 * pair) * 100) / 100);
    }
  }
  return Array.from(totals);
}

export function resolveAvailableLoads(equipment: EquipmentLoadConfig): number[] {
  const cacheKey = JSON.stringify(equipment);
  const cached = resolveCache.get(cacheKey);
  if (cached) return cached;

  let loads: number[];
  switch (equipment.load_mode) {
    case "list":
      loads = [...(equipment.available_loads ?? [])];
      break;
    case "range":
      loads = rangeLoads(equipment.min_kg ?? 0, equipment.max_kg ?? 0, equipment.step_kg ?? 0);
      break;
    case "barbell": {
      const pairs = [...(equipment.plate_pairs ?? []), ...(equipment.micro_plates ?? [])];
      loads = barbellLoads(equipment.bar_kg ?? 0, pairs);
      break;
    }
  }

  const sorted = Array.from(new Set(loads)).sort((a, b) => a - b);
  resolveCache.set(cacheKey, sorted);
  return sorted;
}

export function snapLoad(
  target: number,
  equipment: EquipmentLoadConfig,
  dir: "nearest" | "down" = "down"
): SnapResult {
  const loads = resolveAvailableLoads(equipment);
  if (loads.length === 0) {
    return { real: target, rounded: false, delta: 0 };
  }

  let real: number;
  if (dir === "down") {
    const lower = loads.filter((l) => l <= target);
    real = lower.length > 0 ? lower[lower.length - 1] : loads[0];
  } else {
    real = loads.reduce((closest, l) =>
      Math.abs(l - target) < Math.abs(closest - target) ? l : closest
    , loads[0]);
  }

  const delta = Math.round((real - target) * 100) / 100;
  return { real, rounded: delta !== 0, delta };
}
