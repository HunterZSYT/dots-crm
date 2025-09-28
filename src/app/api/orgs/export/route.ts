// src/app/api/orgs/export/route.ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

function csvEscape(v: any): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function csvLine(cells: any[]) {
  return cells.map(csvEscape).join(",") + "\r\n";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const q = searchParams.get("q")?.trim() || "";

  const cities = searchParams.getAll("city").filter(Boolean);
  const countries = searchParams.getAll("country").filter(Boolean);
  const sectors = searchParams.getAll("sector").filter(Boolean);
  const statuses = searchParams.getAll("status").filter(Boolean).map((s) => s.toLowerCase());

  const supabase = await createServerSupabase();

  // Load orgs by filters (including q)
  let orgQ = supabase
    .from("organizations")
    .select("id,name,website,city,country,sector")
    .order("id", { ascending: true });

  if (q) orgQ = orgQ.ilike("name", `%${q}%`);
  if (cities.length) orgQ = orgQ.in("city", cities);
  if (countries.length) orgQ = orgQ.in("country", countries);
  if (sectors.length) orgQ = orgQ.in("sector", sectors);

  const { data: orgRows, error: orgErr } = await orgQ;
  if (orgErr) {
    return NextResponse.json({ error: orgErr.message }, { status: 500 });
  }
  const orgs = (orgRows ?? []) as {
    id: number; name: string; website: string|null; city: string|null; country: string|null; sector: string|null;
  }[];

  // Optionally filter by status: via view org_latest_event_v
  let withStatus = new Map<number, string | null>();
  if (orgs.length) {
    const ids = orgs.map((o) => o.id);
    const { data: stRows, error: stErr } = await supabase
      .from("org_latest_event_v")
      .select("org_id,status")
      .in("org_id", ids);
    if (stErr) {
      return NextResponse.json({ error: stErr.message }, { status: 500 });
    }
    (stRows ?? []).forEach((r: any) => {
      withStatus.set(r.org_id as number, (r.status as string | null) ?? null);
    });
  }

  const orgsFilteredByStatus = statuses.length
    ? orgs.filter((o) => {
        const st = (withStatus.get(o.id) || "").toLowerCase();
        return statuses.includes(st);
      })
    : orgs;

  // Fetch contacts in one go, group per org id
  let emailMap = new Map<number, string[]>();
  let phoneMap = new Map<number, string[]>();
  if (orgsFilteredByStatus.length) {
    const ids = orgsFilteredByStatus.map((o) => o.id);
    const { data: contacts, error: cErr } = await supabase
      .from("contacts")
      .select("org_id,email,phone")
      .in("org_id", ids);

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    for (const r of contacts ?? []) {
      const orgId = r.org_id as number;
      if (r.email) {
        const arr = emailMap.get(orgId) || [];
        const lower = String(r.email).toLowerCase();
        if (!arr.includes(lower)) arr.push(lower);
        emailMap.set(orgId, arr);
      }
      if (r.phone) {
        const arr = phoneMap.get(orgId) || [];
        const val = String(r.phone);
        if (!arr.includes(val)) arr.push(val);
        phoneMap.set(orgId, arr);
      }
    }
  }

  // Determine max columns
  const maxEmails = Math.max(0, ...Array.from(emailMap.values()).map((a) => a.length));
  const maxPhones = Math.max(0, ...Array.from(phoneMap.values()).map((a) => a.length));

  // Build CSV
  const headers = [
    "Org name",
    "Website",
    "City",
    "Country",
    "Sector",
    "Status",
    ...Array.from({ length: maxEmails }, (_, i) => `Email_${i + 1}`),
    ...Array.from({ length: maxPhones }, (_, i) => `Number_${i + 1}`),
  ];

  let csv = "";
  csv += csvLine(headers);

  for (const o of orgsFilteredByStatus) {
    const status = withStatus.get(o.id) ?? "";
    const emails = emailMap.get(o.id) ?? [];
    const phones = phoneMap.get(o.id) ?? [];

    const row = [
      o.name ?? "",
      o.website ?? "",
      o.city ?? "",
      o.country ?? "",
      o.sector ?? "",
      status ? String(status).replaceAll("_", " ") : "",
      ...Array.from({ length: maxEmails }, (_, i) => emails[i] ?? ""),
      ...Array.from({ length: maxPhones }, (_, i) => phones[i] ?? ""),
    ];

    csv += csvLine(row);
  }

  const filename = `organizations_export_${new Date().toISOString().slice(0,10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
