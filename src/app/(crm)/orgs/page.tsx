// src/app/(crm)/orgs/page.tsx
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OrgTableClient from "./OrgTableClient";

export const revalidate = 0;

/* ---------- Types ---------- */
type OrgBase = {
  id: number;
  name: string;
  website: string | null;
  city: string | null;
  country: string | null;
  sector: string | null;
};

type LatestEvent = {
  org_id: number;
  event_at: string | null;
  medium: string | null;
  status: string | null;
  notes_short: string | null;
};

type SP = Record<string, string | string[] | undefined>;

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .flatMap((x) => String(x).split(","))
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return String(v)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/* ---------- Page ---------- */
export default async function OrgsPage({
  searchParams,
}: {
  searchParams: Promise<SP> | SP;
}) {
  const sp = (await searchParams) as SP;

  // --- Auth gate ---
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Onboarding gate: must have profiles.full_name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.full_name) {
    // Force users who haven’t set their name yet to onboarding
    redirect("/onboarding");
  }

  // Membership gate: must be in team_members
  const { data: tm, error: tmErr } = await supabase
    .from("team_members")
    .select("user_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (tmErr) {
    return <pre className="p-4 text-red-600">{tmErr.message}</pre>;
  }
  if (!tm) redirect("/no-access");

  // --- Read filter params ---
  const q = (typeof sp.q === "string" ? sp.q : "").trim();
  const cityParams = toArray(sp.city);
  const countryParams = toArray(sp.country);
  const sectorParams = toArray(sp.sector);
  const statusParams = toArray(sp.status).map((s) => s.toLowerCase()); // incl. "fresh"

  // --- Base orgs query with multi IN filters ---
  let orgQ = supabase
    .from("organizations")
    .select("id,name,website,city,country,sector")
    .order("id", { ascending: true });

  if (q) orgQ = orgQ.ilike("name", `%${q}%`);
  if (cityParams.length) orgQ = orgQ.in("city", cityParams);
  if (countryParams.length) orgQ = orgQ.in("country", countryParams);
  if (sectorParams.length) orgQ = orgQ.in("sector", sectorParams);

  const { data: orgRows, error: orgErr } = await orgQ;
  if (orgErr) return <pre className="p-4 text-red-600">{orgErr.message}</pre>;

  let orgsBase: OrgBase[] = (orgRows ?? []) as OrgBase[];

  // --- Latest-event lookup for listed orgs ---
  const latestMap = new Map<number, LatestEvent>();
  const statusOptionSet = new Set<string>(); // for header list

  if (orgsBase.length) {
    const ids = orgsBase.map((o) => o.id);
    const { data: latestRows, error: latestErr } = await supabase
      .from("org_latest_event_v")
      .select("org_id,event_at,medium,status,notes_short")
      .in("org_id", ids);

    if (latestErr) {
      return <pre className="p-4 text-red-600">{latestErr.message}</pre>;
    }

    (latestRows ?? []).forEach((r: any) => {
      latestMap.set(r.org_id as number, r as LatestEvent);
      if (r.status) statusOptionSet.add(String(r.status));
    });

    // Include "Fresh" option if some orgs have no events
    const hasFresh = orgsBase.some((o) => !latestMap.get(o.id)?.event_at);
    if (hasFresh) statusOptionSet.add("Fresh");

    // Apply status filter (in-memory) if provided
    if (statusParams.length) {
      const keep = new Set(
        orgsBase
          .filter((o) => {
            const ev = latestMap.get(o.id);
            if (!ev || !ev.status) return statusParams.includes("fresh");
            return statusParams.includes(String(ev.status).toLowerCase());
          })
          .map((o) => o.id)
      );
      orgsBase = orgsBase.filter((o) => keep.has(o.id));
    }
  }

  // --- Distincts for header filters (from current set) ---
  const cities = Array.from(
    new Set(orgsBase.map((o) => o.city).filter(Boolean))
  ) as string[];
  const countries = Array.from(
    new Set(orgsBase.map((o) => o.country).filter(Boolean))
  ) as string[];
  const sectors = Array.from(
    new Set(orgsBase.map((o) => o.sector).filter(Boolean))
  ) as string[];
  const statuses = Array.from(statusOptionSet);

  // --- Build rows for client table ---
  const orgs = orgsBase.map((o) => ({
    org: { ...o, last_event_at: latestMap.get(o.id)?.event_at ?? null },
    recent: latestMap.get(o.id),
  }));

  const helloName =
    profile?.full_name ||
    (user.user_metadata?.full_name as string | undefined) ||
    (user.email ? user.email.split("@")[0] : "there");

  return (
    <>
      {/* Top greeting */}
      <div className="px-6 pt-4">
        <h1 className="text-lg font-semibold">Hello, {helloName}</h1>
      </div>

      <OrgTableClient
        orgs={orgs}
        filters={{
          selected: {
            city: cityParams,
            country: countryParams,
            sector: sectorParams,
            status: statusParams, // lowercased incl. "fresh"
          },
          options: { cities, countries, sectors, statuses },
        }}
      />
    </>
  );
}
