import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PesoClient } from "@/components/perfil/PesoClient";

const WEEKS_OF_HISTORY = 8;

export default async function PesoPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const since = new Date();
  since.setDate(since.getDate() - WEEKS_OF_HISTORY * 7);

  const { data: logs } = await supabase
    .from("body_weight_logs")
    .select("*")
    .gte("logged_at", since.toISOString())
    .order("logged_at", { ascending: true });

  return <PesoClient userId={userData.user.id} initialLogs={logs ?? []} />;
}
