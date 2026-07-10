import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CALIBRATION_SESSION_EXERCISES,
  isCalibrationSessionEnabled,
  type CalibrationSessionType,
  type RehabPhase,
} from "@/lib/calibration";
import { CalibracionSessionClient } from "@/components/perfil/CalibracionSessionClient";

const VALID_SESSION_TYPES = Object.keys(CALIBRATION_SESSION_EXERCISES) as CalibrationSessionType[];

export default async function CalibracionSessionPage({ params }: { params: Promise<{ sessionType: string }> }) {
  const { sessionType } = await params;
  if (!VALID_SESSION_TYPES.includes(sessionType as CalibrationSessionType)) notFound();
  const typedSessionType = sessionType as CalibrationSessionType;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: profile } = await supabase.from("user_profiles").select("rehab_phase").eq("id", userData.user.id).maybeSingle();
  const rehabPhase = (profile?.rehab_phase as RehabPhase | null) ?? null;

  const gate = isCalibrationSessionEnabled(typedSessionType, rehabPhase);
  if (!gate.enabled) redirect("/calibracion");

  return <CalibracionSessionClient userId={userData.user.id} sessionType={typedSessionType} rehabPhase={rehabPhase} />;
}
