// src/app/(crm)/orgs/analytics/page.tsx
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

/** Tables in your DB */
const ORGS_TABLE = "organizations";
const EVENTS_TABLE = "contact_history";

/* ---------------- date helpers ---------------- */
const startOfDay = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

type SearchParamsObj = Record<string, string | string[] | undefined>;
const getParam = (sp: SearchParamsObj, k: string, fb = "") =>
  Array.isArray(sp[k]) ? (sp[k]?.[0] ?? fb) : (sp[k] ?? fb);

/* ---------------- page ---------------- */
export default async function AnalyticsPage({
  searchParams,
}: {
  // <— Next 15: searchParams is a Promise, so type it that way and await it
  searchParams: Promise<SearchParamsObj>;
}) {
  const sp = await searchParams;
  const preset = String(getParam(sp, "preset", "today")).toLowerCase();
  const group = String(getParam(sp, "group", "day")).toLowerCase() as
    | "day"
    | "month"
    | "year";

  // Resolve range from preset
  const todayStart = startOfDay(new Date());
  let from: Date | null = null;
  switch (preset) {
    case "today":
      from = todayStart;
      break;
    case "7d":
      from = addDays(todayStart, -6);
      break;
    case "30d":
      from = addDays(todayStart, -29);
      break;
    case "90d":
      from = addDays(todayStart, -89);
      break;
    case "365d":
      from = addDays(todayStart, -364);
      break;
    case "all":
    default:
      from = null;
  }

  const supabase = await createServerSupabase();

  /* ---------- Orgs: global counts & top sectors ---------- */
  const { data: orgsData, error: orgsErr } = await supabase
    .from(ORGS_TABLE)
    .select("id,name,sector,country,city,last_event_at")
    .limit(100000);
  if (orgsErr) throw new Error(orgsErr.message);

  const totalOrgs = orgsData.length;
  const sectorTypes = new Set(orgsData.map((o) => o.sector).filter(Boolean)).size;
  const countryTypes = new Set(orgsData.map((o) => o.country).filter(Boolean)).size;
  const cityTypes = new Set(orgsData.map((o) => o.city).filter(Boolean)).size;

  const sectorCounts = orgsData.reduce<Record<string, number>>((acc, o) => {
    const s = (o.sector ?? "").trim();
    if (!s) return acc;
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  const sectorRows = Object.entries(sectorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([sector, count]) => ({ sector, count }));

  /* ---------- Events: calls/emails, statuses, group-by ---------- */
  let eventsQ = supabase
    .from(EVENTS_TABLE)
    .select("event_at,medium,status,contact_id")
    .order("event_at", { ascending: false })
    .limit(100000);

  if (from) eventsQ = eventsQ.gte("event_at", from.toISOString());

  const { data: events, error: eventsErr } = await eventsQ;
  if (eventsErr) throw new Error(eventsErr.message);

  // Today metrics (from start of *today*)
  const todayISO = todayStart.toISOString();
  const callsToday = events.filter((e) => e.medium?.toLowerCase() === "call" && e.event_at >= todayISO).length;
  const emailsToday = events.filter((e) => e.medium?.toLowerCase() === "email" && e.event_at >= todayISO).length;

  // Global status totals (all time)
  const statusTotals = events.reduce<Record<string, number>>((acc, e) => {
    const s = (e.status ?? "").toLowerCase();
    if (!s) return acc;
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  const followUpsAll = statusTotals["follow_up_lead"] ?? 0;
  const meetingsAll = statusTotals["meeting_fixed"] ?? 0;
  const deadAll = statusTotals["dead_lead"] ?? 0;
  const ongoingAll = statusTotals["ongoing_project"] ?? 0;

  // Top orgs interacted within the window (count all mediums)
  // We need org_id to do this properly; we only have contact_id here.
  // If you want per-org accuracy, join via a view or include org_id in contact_history.
  // For now, we’ll approximate by finding at least one org from contacts for those contact_ids.
  const contactIds = Array.from(new Set(events.map((e) => e.contact_id).filter(Boolean)));
  let contactToOrg = new Map<number, number>();
  if (contactIds.length) {
    const { data: cs } = await supabase
      .from("contacts")
      .select("id,org_id")
      .in("id", contactIds.slice(0, 100000));
    (cs ?? []).forEach((c: any) => contactToOrg.set(c.id, c.org_id));
  }

  const orgHitCounts: Record<number, number> = {};
  for (const e of events) {
    const cid = e.contact_id as number | null;
    if (!cid) continue;
    const oid = contactToOrg.get(cid);
    if (!oid) continue;
    orgHitCounts[oid] = (orgHitCounts[oid] ?? 0) + 1;
  }

  const topOrgs = Object.entries(orgHitCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([oid, total]) => {
      const o = orgsData.find((x) => String(x.id) === String(oid));
      return { id: Number(oid), name: o?.name ?? `Org #${oid}`, total };
    });

  // Activity grouped (calls/emails) by chosen granularity
  const grouped = new Map<string, { calls: number; emails: number; total: number }>();
  for (const e of events) {
    const d = new Date(e.event_at);
    const key =
      group === "year"
        ? String(d.getFullYear())
        : group === "month"
        ? ym(d)
        : d.toISOString().slice(0, 10); // YYYY-MM-DD

    const row = grouped.get(key) ?? { calls: 0, emails: 0, total: 0 };
    if (e.medium?.toLowerCase() === "call") row.calls++;
    if (e.medium?.toLowerCase() === "email") row.emails++;
    row.total++;
    grouped.set(key, row);
  }
  const groupedRows = Array.from(grouped.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([period, v]) => ({ period, ...v }));

  /* ---------- UI helpers ---------- */
  const current = new URLSearchParams();
  current.set("preset", preset);
  current.set("group", group);

  const buildHref = (next: Partial<{ preset: string; group: string }>) => {
    const sp2 = new URLSearchParams(current);
    if (next.preset) sp2.set("preset", next.preset);
    if (next.group) sp2.set("group", next.group);
    return `/orgs/analytics?${sp2.toString()}`;
  };

  const PresetButton = ({ label, val }: { label: string; val: string }) => (
    <Link
      className={`px-3 py-1 rounded border ${preset === val ? "bg-black text-white" : "hover:bg-muted"}`}
      href={buildHref({ preset: val })}
    >
      {label}
    </Link>
  );

  const GroupButton = ({ label, val }: { label: string; val: "day" | "month" | "year" }) => (
    <Link
      className={`px-3 py-1 rounded border ${group === val ? "bg-black text-white" : "hover:bg-muted"}`}
      href={buildHref({ group: val })}
    >
      {label}
    </Link>
  );

  /* ---------- render ---------- */
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Global analytics</h1>
        <Link href="/orgs" className="px-3 py-2 rounded border hover:bg-muted">
          Back to list
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium mr-2">Range:</span>
        <PresetButton label="TODAY" val="today" />
        <PresetButton label="7D" val="7d" />
        <PresetButton label="30D" val="30d" />
        <PresetButton label="90D" val="90d" />
        <PresetButton label="365D" val="365d" />
        <PresetButton label="ALL" val="all" />
        <span className="text-sm font-medium ml-4 mr-2">Group:</span>
        <GroupButton label="day" val="day" />
        <GroupButton label="month" val="month" />
        <GroupButton label="year" val="year" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi title="Total orgs" value={totalOrgs} />
        <Kpi title="Sector types" value={sectorTypes} />
        <Kpi title="Country types" value={countryTypes} />
        <Kpi title="City types" value={cityTypes} />
        <Kpi title="Calls today" value={callsToday} />
        <Kpi title="Emails today" value={emailsToday} />
        <Kpi title="Follow-ups (all time)" value={followUpsAll} />
        <Kpi title="Meetings fixed (all time)" value={meetingsAll} />
        <Kpi title="Dead leads (all time)" value={deadAll} />
        <Kpi title="Ongoing projects (all time)" value={ongoingAll} />
      </div>

      {/* Sectors table */}
      <Section title="Most used sectors (by org count)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Sector</th>
              <th className="text-right py-2 w-24">Orgs</th>
            </tr>
          </thead>
          <tbody>
            {sectorRows.map((r) => (
              <tr key={r.sector} className="border-b">
                <td className="py-2">{r.sector}</td>
                <td className="py-2 text-right">{r.count}</td>
              </tr>
            ))}
            {sectorRows.length === 0 && (
              <tr>
                <td colSpan={2} className="py-3 text-muted-foreground">
                  No data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      {/* Top orgs */}
      <Section title={`Top orgs interacted with (${preset.toUpperCase()})`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Organization</th>
              <th className="text-right py-2 w-24">Total</th>
            </tr>
          </thead>
          <tbody>
            {topOrgs.map((o) => (
              <tr key={o.id} className="border-b">
                <td className="py-2">{o.name}</td>
                <td className="py-2 text-right">{o.total}</td>
              </tr>
            ))}
            {topOrgs.length === 0 && (
              <tr>
                <td colSpan={2} className="py-3 text-muted-foreground">
                  No interactions in range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      {/* Activity grouped */}
      <Section title={`Activity by ${group}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Period</th>
              <th className="text-right py-2 w-24">Calls</th>
              <th className="text-right py-2 w-24">Emails</th>
              <th className="text-right py-2 w-24">Total</th>
            </tr>
          </thead>
          <tbody>
            {groupedRows.map((r) => (
              <tr key={r.period} className="border-b">
                <td className="py-2">{r.period}</td>
                <td className="py-2 text-right">{r.calls}</td>
                <td className="py-2 text-right">{r.emails}</td>
                <td className="py-2 text-right">{r.total}</td>
              </tr>
            ))}
            {groupedRows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-muted-foreground">
                  No activity in range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

/* --------------- tiny UI bits --------------- */
function Kpi({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border">
      <div className="px-3 py-2 border-b text-sm font-medium">{title}</div>
      <div className="p-3">{children}</div>
    </div>
  );
}
