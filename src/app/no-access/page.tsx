// src/app/no-access/page.tsx
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

type SearchParams =
  Promise<Record<string, string | string[] | undefined>>;

export default async function NoAccess({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // ✅ Next.js 15 requires awaiting searchParams before using it
  const sp = await searchParams;
  const nextRaw = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const next = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/orgs";

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in → go to login and preserve desired target
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);

  // Must complete onboarding first
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.full_name) {
    redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  }

  // If the user is already approved (member or superadmin), send them on
  const { data: memberRow } = await supabase
    .from("team_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: superRow } = await supabase
    .from("superadmins")
    .select("email")
    .eq("email", user.email ?? "")
    .maybeSingle();

  const isMember = !!memberRow;
  const isSuperadmin = !!superRow;

  if (isMember || isSuperadmin) {
    redirect(next);
  }

  // Otherwise show the waiting-for-approval screen
  return (
    <main className="p-6 space-y-2">
      <h1 className="text-xl font-semibold">Hi {profile.full_name}.</h1>
      <p>You're signed in but awaiting approval from an admin.</p>
      <p className="text-sm text-muted-foreground">
        Once approved, you’ll get access automatically.
      </p>
    </main>
  );
}
