// src/app/onboarding/page.tsx
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

async function saveProfile(formData: FormData) {
  "use server";
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const full_name = String(formData.get("full_name") || "").trim();
  if (!full_name) throw new Error("Please enter your name.");

  // upsert profile
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, full_name });
  if (error) throw new Error(error.message);

  // after onboarding, send to no-access unless already a member
  const { data: tm } = await supabase
    .from("team_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  revalidatePath("/no-access");
  if (tm) redirect("/orgs");
  redirect("/no-access");
}

export default async function OnboardingPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // prefill suggestion (from profile, Google, or email local part)
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const suggestion =
    profile?.full_name ||
    (user.user_metadata?.full_name as string | undefined) ||
    (user.email ? user.email.split("@")[0] : "");

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">What should we call you?</h1>
      <p className="text-sm text-muted-foreground">
        We’ll use this name throughout the app.
      </p>

      <form action={saveProfile} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Full name</label>
          <input
            name="full_name"
            defaultValue={suggestion}
            placeholder="Your name"
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <button className="px-3 py-2 rounded border">Continue</button>
      </form>
    </main>
  );
}
