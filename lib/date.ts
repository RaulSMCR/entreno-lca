export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayWeekday(): string {
  return WEEKDAYS[new Date().getDay()];
}

export function yesterdayWeekday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return WEEKDAYS[d.getDay()];
}
