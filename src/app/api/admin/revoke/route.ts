// src/app/api/admin/revoke/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

async function requireOwner(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { data: me } = await supabase
    .from("team_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!me || me.role !== "owner") return NextResponse.redirect(new URL("/no-access", req.url));
  return null;
}

export async function POST(req: Request) {
  const guard = await requireOwner(req);
  if (guard) return guard;

  let user_id = "";
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await req.json();
    user_id = String(body.user_id || "");
  } else {
    const form = await req.formData();
    user_id = String(form.get("user_id") || "");
  }

  if (!user_id) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("team_members").delete().eq("user_id", user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.redirect(new URL("/admin", req.url), 303);
}
