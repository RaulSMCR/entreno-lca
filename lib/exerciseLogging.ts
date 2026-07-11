// E-2: qué campos mostrar en el logger de sesión según el propósito real del
// ejercicio (exercises.purpose), no según unit/category — ver
// clasificacion_ejercicios_lca.md. cardio_intervalos, distancia_carga y
// potencia_tiempo_fijo no consumen esta config (van a componentes propios:
// CardioSetRow, DistanceLoadRow, FixedWindowPowerRow) pero igual devuelven
// una config coherente.

export type ExercisePurpose =
  | "fuerza_carga"
  | "isometria_tiempo"
  | "movilidad_repeticiones"
  | "movilidad_tiempo"
  | "distancia_carga"
  | "potencia_tiempo_fijo"
  | "cardio_intervalos";

export type LoggingFieldConfig = {
  purpose: ExercisePurpose;
  /** Selector/input de carga en kg. */
  showLoad: boolean;
  /** Contador +/- de una cantidad discreta (reps, metros...). */
  showReps: boolean;
  /** Cronómetro de cuenta arriba (holds isométricos y movilidad por tiempo). */
  showStopwatch: boolean;
  /** Toggle izquierda/derecha/ambos. */
  showSide: boolean;
  /** Slider 0-10 de restricción de rango de movimiento percibido. */
  showRomRpe: boolean;
  /** "¿A qué rep sentiste el RPE?" — solo tiene sentido con reps discretas de fuerza. */
  showRpeAtRep: boolean;
  showFailureCheckbox: boolean;
  showNotes: boolean;
  showPostureCheck: boolean;
  /** Ventana de tiempo fija en segundos (potencia_tiempo_fijo). */
  fixedWindowSeconds: number | null;
};

const SCHEMAS: Record<ExercisePurpose, LoggingFieldConfig> = {
  fuerza_carga: {
    purpose: "fuerza_carga",
    showLoad: true,
    showReps: true,
    showStopwatch: false,
    showSide: false,
    showRomRpe: false,
    showRpeAtRep: true,
    showFailureCheckbox: true,
    showNotes: false,
    showPostureCheck: false,
    fixedWindowSeconds: null,
  },
  isometria_tiempo: {
    purpose: "isometria_tiempo",
    showLoad: false,
    showReps: false,
    showStopwatch: true,
    showSide: false,
    showRomRpe: false,
    showRpeAtRep: false,
    showFailureCheckbox: false,
    showNotes: false,
    showPostureCheck: false,
    fixedWindowSeconds: null,
  },
  movilidad_repeticiones: {
    purpose: "movilidad_repeticiones",
    showLoad: false,
    showReps: true,
    showStopwatch: false,
    showSide: true,
    showRomRpe: true,
    showRpeAtRep: false,
    showFailureCheckbox: false,
    showNotes: true,
    showPostureCheck: false,
    fixedWindowSeconds: null,
  },
  movilidad_tiempo: {
    purpose: "movilidad_tiempo",
    showLoad: false,
    showReps: false,
    showStopwatch: true,
    showSide: true,
    showRomRpe: false,
    showRpeAtRep: false,
    showFailureCheckbox: false,
    showNotes: true,
    showPostureCheck: false,
    fixedWindowSeconds: null,
  },
  distancia_carga: {
    purpose: "distancia_carga",
    showLoad: true,
    showReps: true,
    showStopwatch: false,
    showSide: false,
    showRomRpe: false,
    showRpeAtRep: false,
    showFailureCheckbox: false,
    showNotes: false,
    showPostureCheck: true,
    fixedWindowSeconds: null,
  },
  potencia_tiempo_fijo: {
    purpose: "potencia_tiempo_fijo",
    showLoad: true,
    showReps: true,
    showStopwatch: false,
    showSide: false,
    showRomRpe: false,
    showRpeAtRep: false,
    showFailureCheckbox: false,
    showNotes: false,
    showPostureCheck: false,
    fixedWindowSeconds: 20,
  },
  cardio_intervalos: {
    purpose: "cardio_intervalos",
    showLoad: false,
    showReps: false,
    showStopwatch: false,
    showSide: false,
    showRomRpe: false,
    showRpeAtRep: false,
    showFailureCheckbox: false,
    showNotes: false,
    showPostureCheck: false,
    fixedWindowSeconds: null,
  },
};

export function getLoggingSchema(purpose: string): LoggingFieldConfig {
  return SCHEMAS[purpose as ExercisePurpose] ?? SCHEMAS.fuerza_carga;
}
