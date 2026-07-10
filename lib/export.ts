// Export de registros a CSV/JSON y disparo de descarga en el navegador.
// Las funciones de armado de filas son puras y testeadas; downloadFile toca
// el DOM y queda fuera de los tests unitarios.

export type HistoryExportRow = {
  date: string;
  exercise: string;
  /** Distingue el slot cuando el mismo ejercicio tiene más de un
   *  template_slot_id entre las filas exportadas — p.ej. una versión de
   *  fuerza y otra de volumen del mismo ejercicio. null cuando no hace
   *  falta desambiguar (el ejercicio solo tiene un slot en el export). */
  scheme: string | null;
  set_number: number;
  load_kg: number | null;
  reps: number | null;
  rpe: number | null;
  is_failure: boolean;
};

export type SetLogForExport = {
  session_id: string;
  exercise_id: string;
  /** template_slots.id — exercise_id no identifica un slot: el mismo
   *  ejercicio puede repetirse en más de un slot con propósitos distintos. */
  template_slot_id: string;
  set_number: number;
  actual_load_kg: number | null;
  actual_reps: number | null;
  rpe_reported: number | null;
  is_failure: boolean;
};

export function buildHistoryRows(
  logs: SetLogForExport[],
  sessionDates: Record<string, string>,
  exerciseNames: Record<string, string>,
  slotSchemes: Record<string, string> = {}
): HistoryExportRow[] {
  // Solo desambiguar cuando el ejercicio realmente tiene más de un
  // template_slot_id distinto entre las filas exportadas — evita agregar
  // ruido ("scheme") a ejercicios que no lo necesitan.
  const slotIdsByExercise = new Map<string, Set<string>>();
  for (const l of logs) {
    const ids = slotIdsByExercise.get(l.exercise_id) ?? new Set<string>();
    ids.add(l.template_slot_id);
    slotIdsByExercise.set(l.exercise_id, ids);
  }

  return logs
    .map((l) => {
      const needsScheme = (slotIdsByExercise.get(l.exercise_id)?.size ?? 0) > 1;
      return {
        date: sessionDates[l.session_id] ?? "",
        exercise: exerciseNames[l.exercise_id] ?? l.exercise_id,
        scheme: needsScheme ? (slotSchemes[l.template_slot_id] ?? l.template_slot_id) : null,
        set_number: l.set_number,
        load_kg: l.actual_load_kg,
        reps: l.actual_reps,
        rpe: l.rpe_reported,
        is_failure: l.is_failure,
      };
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.exercise.localeCompare(b.exercise) ||
        (a.scheme ?? "").localeCompare(b.scheme ?? "") ||
        a.set_number - b.set_number
    );
}

export function rowsToCsv(rows: HistoryExportRow[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]) as (keyof HistoryExportRow)[];

  function escapeCell(value: unknown): string {
    const str = value == null ? "" : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(",")),
  ];
  return lines.join("\n");
}

export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadHistoryAsCsv(filename: string, rows: HistoryExportRow[]): void {
  downloadFile(filename, rowsToCsv(rows), "text/csv;charset=utf-8");
}

export function downloadHistoryAsJson(filename: string, rows: HistoryExportRow[]): void {
  downloadFile(filename, JSON.stringify(rows, null, 2), "application/json;charset=utf-8");
}
