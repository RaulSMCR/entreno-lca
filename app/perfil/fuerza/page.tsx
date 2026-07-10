import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FuerzaClient } from "@/components/perfil/FuerzaClient";

export default async function FuerzaPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  return <FuerzaClient userId={userData.user.id} />;
}
