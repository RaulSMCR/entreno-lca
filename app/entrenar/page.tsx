import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EntrenarClient } from "@/components/entrenar/EntrenarClient";

export default async function EntrenarPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  return <EntrenarClient userId={userData.user.id} />;
}
