import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SemanaClient } from "@/components/semana/SemanaClient";

export default async function SemanaPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const [{ data: schedule }, { data: templates }] = await Promise.all([
    supabase.from("weekly_schedule").select("*"),
    supabase.from("day_templates").select("id, code, title").order("code"),
  ]);

  return <SemanaClient initialSchedule={schedule ?? []} templates={templates ?? []} />;
}
