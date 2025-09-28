import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Allows access if:
 *  - the user has role "owner" in team_members (self row), OR
 *  - the user email exists in `superadmins` (checked with service role)
 * Returns the authed user object on success.
 */
export async function requireOwnerOrSuper() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Read your own membership row (RLS policy tm_select_self)
  const { data: me } = await supabase
    .from("team_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (me?.role === "owner") return user;

  // Fallback: check superadmins with service role (bypasses RLS)
  const admin = createAdminClient();
  const { data: sa } = await admin
    .from("superadmins")
    .select("email")
    .eq("email", user.email ?? "")
    .maybeSingle();

  if (sa) return user;

  redirect("/no-access");
}
