import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EquiposClient } from "@/components/equipos/EquiposClient";

export default async function EquiposPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: equipment } = await supabase.from("equipment").select("*").order("name");

  return <EquiposClient initialEquipment={equipment ?? []} />;
}
