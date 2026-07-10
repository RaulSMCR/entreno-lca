import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PerfilClient } from "@/components/perfil/PerfilClient";

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: profile } = await supabase.from("user_profiles").select("*").eq("id", userData.user.id).maybeSingle();

  return <PerfilClient userId={userData.user.id} initialProfile={profile} />;
}
