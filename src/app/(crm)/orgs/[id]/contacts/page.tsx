// SSR page – list contacts for an org (shows latest history summary per contact)
import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import Toolbar from "@/app/(crm)/orgs/Toolbar";
import AddContactDialog from "./AddContactDialog";
import ContactRow from "./ContactRow";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Params = { id: string };
type SP = { q?: string };

export const revalidate = 0;

type LastHistory = {
  event_at: string | null;
  medium: string | null;
  status: string | null;
  notes: string | null;
};

function summarize(last?: LastHistory) {
  if (!last) return "—";
  const parts: string[] = [];
  if (last.medium) parts.push(last.medium);
  if (last.status) parts.push(last.status.replaceAll("_", " "));
  if (last.notes && last.notes.trim()) {
    const n = last.notes.trim();
    parts.push(`“${n.length > 60 ? n.slice(0, 57) + "…" : n}”`);
  }
  if (last.event_at) parts.push(new Date(last.event_at).toLocaleDateString());
  return parts.join(" • ") || "—";
}

export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<SP> | SP;
}) {
  const { id } = await params;
  const sp = (await searchParams) as SP | undefined;

  const orgId = Number(id);
  const q = typeof sp?.q === "string" ? sp.q.trim() : "";

  const supabase = await createServerSupabase();

  // org meta (breadcrumb)
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id,name")
    .eq("id", orgId)
    .maybeSingle();
  if (orgErr) return <pre className="p-4 text-red-600">{orgErr.message}</pre>;

  /**
   * Contacts + their most recent history item as last_history[0]
   * - we alias the nested relation to `last_history`
   * - then order/limit in the foreign table to get just the latest item
   */
  let query = supabase
    .from("contacts")
    .select(
      `
      id,
      person_name,
      designation,
      email,
      phone,
      last_history:contact_history (
        event_at,
        medium,
        status,
        notes
      )
    `
    )
    .eq("org_id", orgId)
    .order("event_at", { foreignTable: "contact_history", ascending: false })
    .limit(1, { foreignTable: "contact_history" })
    .order("id", { ascending: true });

  if (q) query = query.ilike("person_name", `%${q}%`);

  const { data, error } = await query;
  if (error) return <pre className="p-4 text-red-600">{error.message}</pre>;

  const contacts = (Array.isArray(data) ? data : []).map((row: any) => ({
    id: row.id as number,
    person_name: row.person_name as string | null,
    designation: row.designation as string | null,
    email: row.email as string | null,
    phone: row.phone as string | null,
    last: (row.last_history?.[0] as LastHistory | undefined) ?? undefined,
  }));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          <Link href="/orgs" className="opacity-70 hover:opacity-100">
            Organizations
          </Link>{" "}
          / {org?.name ?? "Org"} contacts
        </h1>
        <div className="flex items-center gap-2">
          <Toolbar placeholder="Search contacts…" initialQuery={q} />
          <AddContactDialog orgId={orgId} />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person name</TableHead>
            <TableHead>Designation</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Number</TableHead>
            <TableHead>Last update</TableHead>
            <TableHead className="text-right">Person history</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {contacts.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-sm text-muted-foreground"
              >
                No contacts yet.
              </TableCell>
            </TableRow>
          ) : (
            contacts.map((c) => (
              <ContactRow
                key={c.id}
                orgId={orgId}
                contact={{
                  id: c.id,
                  person_name: c.person_name,
                  designation: c.designation,
                  email: c.email,
                  phone: c.phone,
                  last_update: null, // not used anymore
                }}
                summary={summarize(c.last)}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
