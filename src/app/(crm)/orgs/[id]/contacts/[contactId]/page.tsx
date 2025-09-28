// SSR page – single contact history with header filters + sorting
import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import AddHistoryDialog from "./AddHistoryDialog";
import HistoryRow from "./HistoryRow";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import FilterHead from "@/app/(crm)/orgs/FilterHead"; // ← re-use the generic header filter
import { ArrowUp, ArrowDown } from "lucide-react";

type Params = { id: string; contactId: string };
type SP = {
  medium?: string;
  status?: string;
  sort?: "event_at" | "follow_up_date";
  dir?: "asc" | "desc";
};

export const revalidate = 0;

export default async function ContactHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<SP> | SP;
}) {
  const { id, contactId } = await params;
  const sp = (await searchParams) as SP | undefined;

  const orgId = Number(id);
  const cid = Number(contactId);

  const mediumParam = typeof sp?.medium === "string" ? sp.medium.trim() : "";
  const statusParam = typeof sp?.status === "string" ? sp.status.trim() : "";

  // default sort: last contact desc
  const sortField: "event_at" | "follow_up_date" =
    sp?.sort === "follow_up_date" ? "follow_up_date" : "event_at";
  const sortDir: "asc" | "desc" = sp?.dir === "asc" || sp?.dir === "desc" ? sp.dir : "desc";

  const supabase = await createServerSupabase();

  // who is this person?
  const { data: contact, error: cErr } = await supabase
    .from("contacts")
    .select("id, person_name")
    .eq("id", cid)
    .maybeSingle();
  if (cErr) return <pre className="p-4 text-red-600">{cErr.message}</pre>;

  // options for the dropdowns (distinct for this contact)
  const [{ data: mediumRows = [] }, { data: statusRows = [] }] = await Promise.all([
    supabase.from("contact_history").select("medium").eq("contact_id", cid),
    supabase.from("contact_history").select("status").eq("contact_id", cid),
  ]);
  const mediumOptions = Array.from(
    new Set((mediumRows as { medium: string | null }[]).map((r) => r.medium))
  );
  const statusOptions = Array.from(
    new Set((statusRows as { status: string | null }[]).map((r) => r.status))
  );

  // history (filters + sort)
  let qb = supabase
    .from("contact_history")
    .select("id, event_at, medium, notes, follow_up_date, status")
    .eq("contact_id", cid);

  if (mediumParam) qb = qb.eq("medium", mediumParam);
  if (statusParam) qb = qb.eq("status", statusParam);

  qb = qb.order(sortField, { ascending: sortDir === "asc", nullsFirst: sortField === "follow_up_date" && sortDir === "asc" });

  const { data: rows = [], error } = await qb;
  if (error) return <pre className="p-4 text-red-600">{error.message}</pre>;

  // util to create links that keep current filters while changing sort
  const mkHref = (next: Partial<SP>) => {
    const p = new URLSearchParams();
    if (mediumParam) p.set("medium", mediumParam);
    if (statusParam) p.set("status", statusParam);
    p.set("sort", next.sort ?? sortField);
    p.set("dir", next.dir ?? sortDir);
    return `?${p.toString()}`;
  };

  const prettyDateTime = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString() : "—";
  const prettyDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString() : "—";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          <Link href="/orgs" className="opacity-70 hover:opacity-100">Organizations</Link>
          {" / "}
          <Link href={`/orgs/${orgId}/contacts`} className="opacity-70 hover:opacity-100">Contacts</Link>
          {" / "}
          {contact?.person_name ?? "Contact"} history
        </h1>
        <AddHistoryDialog contactId={cid} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>

            <TableHead>
              <FilterHead
                label="Contact medium"
                param="medium"
                options={mediumOptions}
                selected={mediumParam || null}
              />
            </TableHead>

            <TableHead>
              <div className="inline-flex items-center gap-1">
                <span>Last contact</span>
                <Link
                  href={mkHref({ sort: "event_at", dir: "asc" })}
                  title="Sort ascending"
                  className={`inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted ${
                    sortField === "event_at" && sortDir === "asc" ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href={mkHref({ sort: "event_at", dir: "desc" })}
                  title="Sort descending"
                  className={`inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted ${
                    sortField === "event_at" && sortDir === "desc" ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Link>
              </div>
            </TableHead>

            <TableHead>Notes</TableHead>

            <TableHead>
              <div className="inline-flex items-center gap-1">
                <span>Follow-up date</span>
                <Link
                  href={mkHref({ sort: "follow_up_date", dir: "asc" })}
                  title="Sort ascending"
                  className={`inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted ${
                    sortField === "follow_up_date" && sortDir === "asc" ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href={mkHref({ sort: "follow_up_date", dir: "desc" })}
                  title="Sort descending"
                  className={`inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted ${
                    sortField === "follow_up_date" && sortDir === "desc" ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Link>
              </div>
            </TableHead>

            <TableHead>
              <FilterHead
                label="Status"
                param="status"
                options={statusOptions}
                selected={statusParam || null}
              />
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
            {rows.length === 0 ? (
                <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No history yet.
                </TableCell>
                </TableRow>
            ) : (
                rows.map((r) => (
                <HistoryRow key={r.id} row={r as any} contactId={cid} />
                ))
            )}
        </TableBody>
      </Table>
    </div>
  );
}


