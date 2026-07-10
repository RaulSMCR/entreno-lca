import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalibracionHomeClient } from "@/components/perfil/CalibracionHomeClient";
import type { RehabPhase } from "@/lib/calibration";

export default async function CalibracionPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: profile } = await supabase.from("user_profiles").select("rehab_phase").eq("id", userData.user.id).maybeSingle();

  return <CalibracionHomeClient rehabPhase={(profile?.rehab_phase as RehabPhase | null) ?? null} />;
}
