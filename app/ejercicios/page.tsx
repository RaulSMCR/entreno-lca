import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EjerciciosClient } from "@/components/ejercicios/EjerciciosClient";

export default async function EjerciciosPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const [{ data: exercises }, { data: equipment }] = await Promise.all([
    supabase.from("exercises").select("*").order("name"),
    supabase.from("equipment").select("id, name").order("name"),
  ]);

  return <EjerciciosClient initialExercises={exercises ?? []} equipment={equipment ?? []} />;
}
