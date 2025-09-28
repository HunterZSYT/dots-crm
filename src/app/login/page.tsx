// src/app/login/page.tsx
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AuthUI from "@/components/AuthUI";

export default async function LoginPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // 1) must have a name first
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.full_name) {
      redirect("/onboarding");
    }

    // 2) then membership check
    const { data: tm } = await supabase
      .from("team_members")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tm) redirect("/no-access");
    redirect("/orgs");
  }

  return (
    <main className="mx-auto flex min-h-screen items-center justify-center p-6">
      <AuthUI />
    </main>
  );
}
