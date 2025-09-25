import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AuthUI from "@/components/AuthUI";

export default async function LoginPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/orgs");
  return (
    <main className="mx-auto flex min-h-screen items-center justify-center p-6">
      <AuthUI />
    </main>
  );
}
