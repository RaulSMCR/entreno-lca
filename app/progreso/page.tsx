import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProgresoClient } from "@/components/progreso/ProgresoClient";

export default async function ProgresoPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  return <ProgresoClient />;
}
