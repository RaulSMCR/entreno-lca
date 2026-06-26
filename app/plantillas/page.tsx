import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlantillasClient } from "@/components/plantillas/PlantillasClient";

export default async function PlantillasPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const [{ data: templates }, { data: slots }, { data: exercises }] = await Promise.all([
    supabase.from("day_templates").select("*").order("code"),
    supabase.from("template_slots").select("*").order("slot_order"),
    supabase.from("exercises").select("id, name, block, unit").eq("is_active", true).order("name"),
  ]);

  return (
    <PlantillasClient
      initialTemplates={templates ?? []}
      initialSlots={slots ?? []}
      exercises={exercises ?? []}
    />
  );
}
