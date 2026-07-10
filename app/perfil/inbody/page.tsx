import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InbodyClient } from "@/components/perfil/InbodyClient";

export default async function InbodyPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const [{ data: scans }, { data: profile }] = await Promise.all([
    supabase.from("inbody_scans").select("*").order("scanned_at", { ascending: false }),
    supabase.from("user_profiles").select("height_cm").eq("id", userData.user.id).maybeSingle(),
  ]);

  return <InbodyClient userId={userData.user.id} initialScans={scans ?? []} heightCm={profile?.height_cm ?? null} />;
}
