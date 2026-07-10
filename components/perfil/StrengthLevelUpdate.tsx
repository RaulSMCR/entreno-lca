"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { evaluateStrengthLevel, getStrengthStandard } from "@/lib/strength-standards";

// Integración post-sesión (U-4): si el ejercicio que acaba de actualizar su
// e1RM tiene un estándar de fuerza (lib/strength-standards.ts) y hay datos de
// peso/sexo en el perfil, mostramos el nivel alcanzado en el resumen. Si falta
// algún dato (sin peso registrado, sexo sin especificar, sin estándar para este
// ejercicio) no renderiza nada — no bloquea el resumen de la sesión.
export function StrengthLevelUpdate({
  userId,
  exerciseName,
  oldE1rmKg,
  newE1rmKg,
}: {
  userId: string;
  exerciseName: string;
  oldE1rmKg: number | null;
  newE1rmKg: number;
}) {
  const [bodyWeightKg, setBodyWeightKg] = useState<number | null>(null);
  const [sex, setSex] = useState<"male" | "female" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [profile, latestWeight] = await Promise.all([
        db.user_profiles.get(userId),
        db.body_weight_logs.orderBy("logged_at").last(),
      ]);
      if (cancelled) return;
      setSex(profile?.sex === "male" || profile?.sex === "female" ? profile.sex : null);
      setBodyWeightKg(latestWeight?.weight_kg ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const standard = getStrengthStandard(exerciseName);
  if (!standard || bodyWeightKg == null || sex == null) return null;

  const current = evaluateStrengthLevel(newE1rmKg, bodyWeightKg, standard, sex);
  const previous = evaluateStrengthLevel(oldE1rmKg ?? 0, bodyWeightKg, standard, sex);
  const leveledUp = current.currentLevel !== previous.currentLevel;

  return (
    <div className="mt-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950">
      <p className="font-medium text-amber-900 dark:text-amber-100">
        {exerciseName} → {newE1rmKg.toFixed(1)}kg ({current.ratio.toFixed(2)}x tu peso) · Nivel: {current.currentLevel}
      </p>
      {leveledUp && <p className="text-amber-800 dark:text-amber-200">¡Alcanzaste el nivel {current.currentLevel}!</p>}
    </div>
  );
}
