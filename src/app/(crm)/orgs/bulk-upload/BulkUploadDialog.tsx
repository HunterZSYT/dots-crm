// src/app/(crm)/orgs/bulk-upload/BulkUploadDialog.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

/* ------------------------------- helpers ------------------------------- */

type Parsed = { headers: string[]; rows: string[][] };

const cell = (v: unknown) => (v == null ? "" : String(v).trim());
const nn = (v: unknown) => { const s = cell(v); return s ? s : null; };

function normalizeUrl(v?: string | null) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `https://${s}`;
}

function parseCSV(text: string): Parsed {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let i = 0;
  let inQ = false;
  const pushField = () => { row.push(cur); cur = ""; };
  const pushRow = () => { if (row.length) out.push(row); row = []; };

  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") pushField();
      else if (c === "\n" || c === "\r") { if (cur.length || row.length) { pushField(); pushRow(); } }
      else cur += c;
    }
    i++;
  }
  if (cur.length || row.length) { row.push(cur); out.push(row); }

  const headers = (out.shift() ?? []).map((s) => s.trim());
  return { headers, rows: out };
}

function guessIndex(headers: string[], keys: string[]) {
  const hay = headers.map((h) => h.toLowerCase().trim());
  for (const k of keys) {
    const i = hay.findIndex((h) => h === k || h.includes(k));
    if (i >= 0) return i;
  }
  return -1;
}

function parseRowSpec(spec: string, max: number): number[] {
  if (!spec.trim()) return Array.from({ length: max }, (_, i) => i);
  const parts = spec.split(",").map((s) => s.trim()).filter(Boolean);
  const idx = new Set<number>();
  for (const p of parts) {
    if (p.includes("-")) {
      const [a, b] = p.split("-").map((n) => n.trim());
      const start = Math.max(1, Number(a) || 1);
      const end = b === "" ? max : Math.min(max, Number(b) || max);
      for (let r = start; r <= end; r++) idx.add(r - 1);
    } else {
      const n = Number(p);
      if (Number.isFinite(n) && n >= 1 && n <= max) idx.add(n - 1);
    }
  }
  return [...idx].sort((x, y) => x - y);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* -------------------------------- props -------------------------------- */

type Props = {
  onImported?: () => void;
  trigger?: React.ReactNode;
};

/* ------------------------------- component ------------------------------ */

export default function BulkUploadDialog({ onImported, trigger }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [phase, setPhase] = useState<"idle" | "preparing" | "importing">("idle");
  const [rowsSpec, setRowsSpec] = useState("");

  // 1:1 indices (mutually exclusive & excluded from multi)
  const [orgNameIdx, setOrgNameIdx] = useState(-1);
  const [websiteIdx, setWebsiteIdx] = useState(-1);
  const [sectorIdx, setSectorIdx] = useState(-1);
  const [cityIdx, setCityIdx] = useState(-1);
  const [countryIdx, setCountryIdx] = useState(-1);
  const [personIdx, setPersonIdx] = useState(-1);
  const [titleIdx, setTitleIdx] = useState(-1);

  // multi
  const [emailIdxs, setEmailIdxs] = useState<number[]>([]);
  const [phoneIdxs, setPhoneIdxs] = useState<number[]>([]);

  // mutual exclusion across both multi lists
  const setEmailIdxsSafe = (next: number[]) => {
    setEmailIdxs(next);
    setPhoneIdxs((prev) => prev.filter((i) => !next.includes(i)));
  };
  const setPhoneIdxsSafe = (next: number[]) => {
    setPhoneIdxs(next);
    setEmailIdxs((prev) => prev.filter((i) => !next.includes(i)));
  };

  const headers = parsed?.headers ?? [];
  const rowCount = parsed?.rows.length ?? 0;

  const picked1to1 = useMemo(
    () => new Set([orgNameIdx, websiteIdx, sectorIdx, cityIdx, countryIdx, personIdx, titleIdx].filter(i => i >= 0)),
    [orgNameIdx, websiteIdx, sectorIdx, cityIdx, countryIdx, personIdx, titleIdx]
  );
  const takenAnywhere = useMemo(
    () => new Set([...picked1to1, ...emailIdxs, ...phoneIdxs]),
    [picked1to1, emailIdxs, phoneIdxs]
  );

  const multiHeaders = useMemo(
    () => headers.map((h, i) => ({ i, h, hidden: picked1to1.has(i) })),
    [headers, picked1to1]
  );

  const canImport = orgNameIdx >= 0 && (emailIdxs.length > 0 || phoneIdxs.length > 0) && !!parsed;

  /* ------------------------------ realtime refresh ------------------------------ */

  const rtChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const attachRealtime = () => {
    if (rtChanRef.current) return;
    const ch = supabase.channel("orgs-bulk-refresh");
    const schedule = () => {
      if (refreshTimer.current) return;
      refreshTimer.current = setTimeout(() => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
        router.refresh();
      }, 400);
    };
    ch
      .on("postgres_changes", { event: "*", schema: "public", table: "organizations" }, schedule)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contacts" }, schedule)
      .subscribe();
    rtChanRef.current = ch;
  };
  const detachRealtime = () => {
    if (rtChanRef.current) supabase.removeChannel(rtChanRef.current);
    rtChanRef.current = null;
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = null;
  };
  useEffect(() => () => detachRealtime(), []);

  /* -------------------------------- file parse -------------------------------- */

  const onFile = async (file: File) => {
    setFileName(file.name);
    setPhase("preparing");
    try {
      let parsedOut: Parsed;
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const AoA: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const headers = ((AoA[0] ?? []) as any[]).map(String);
        const rows = AoA.slice(1).map((r) => (r as any[]).map((v) => (v == null ? "" : String(v))));
        parsedOut = { headers, rows };
      } else {
        parsedOut = parseCSV(await file.text());
      }
      setParsed(parsedOut);

      const H = parsedOut.headers;
      setOrgNameIdx(guessIndex(H, ["org name", "organization", "company", "name"]));
      setWebsiteIdx(guessIndex(H, ["website", "url"]));
      setSectorIdx(guessIndex(H, ["sector", "industry"]));
      setCityIdx(guessIndex(H, ["city", "town"]));
      setCountryIdx(guessIndex(H, ["country", "nation"]));
      setPersonIdx(guessIndex(H, ["person name", "contact name"]));
      setTitleIdx(guessIndex(H, ["designation", "title", "role"]));

      const emailGuess = H.map((h, i) => [h.toLowerCase(), i] as const)
        .filter(([x]) => x.includes("email") || x.includes("mail"))
        .map(([, i]) => i);
      const phoneGuess = H.map((h, i) => [h.toLowerCase(), i] as const)
        .filter(([x]) => x.includes("phone") || x.includes("mobile") || x.includes("number"))
        .map(([, i]) => i);

      setEmailIdxs(emailGuess);
      setPhoneIdxs(phoneGuess);
    } finally {
      setPhase("idle");
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void onFile(f);
  };

  /* --------------------------------- import --------------------------------- */

  const doImport = async () => {
    if (!parsed || !canImport) return;

    attachRealtime();
    setPhase("preparing");

    try {
      const indices =
        rowsSpec.trim() === ""
          ? Array.from({ length: rowCount }, (_, i) => i)
          : parseRowSpec(rowsSpec, rowCount);

      // VALID rows only (non-empty org name)
      const validRows = indices
        .map((k) => parsed.rows[k])
        .filter((r): r is string[] => !!r && cell(r[orgNameIdx]) !== "");

      if (validRows.length === 0) {
        setPhase("idle");
        return;
      }

      // Build per-name patch meta + aggregate contacts per org
      const orgMeta = new Map<
        string,
        { website?: string | null; sector?: string | null; city?: string | null; country?: string | null }
      >();
      const aggByOrg = new Map<
        string,
        { emails: string[]; phones: string[]; person?: string; title?: string }
      >();

      for (const r of validRows) {
        const name = cell(r[orgNameIdx]); // guaranteed non-empty
        const existing = orgMeta.get(name) ?? {};
        const website = websiteIdx >= 0 ? normalizeUrl(nn(r[websiteIdx])) : null;
        const sector  = sectorIdx  >= 0 ? nn(r[sectorIdx])  : null;
        const city    = cityIdx    >= 0 ? nn(r[cityIdx])    : null;
        const country = countryIdx >= 0 ? nn(r[countryIdx]) : null;

        orgMeta.set(name, {
          website: existing.website ?? website ?? null,
          sector:  existing.sector  ?? sector  ?? null,
          city:    existing.city    ?? city    ?? null,
          country: existing.country ?? country ?? null,
        });

        // aggregate per org (across many rows)
        const bucket = aggByOrg.get(name) ?? { emails: [], phones: [] };
        if (personIdx >= 0 && !bucket.person) {
          const p = cell(r[personIdx]);
          if (p) bucket.person = p;
        }
        if (titleIdx >= 0 && !bucket.title) {
          const t = cell(r[titleIdx]);
          if (t) bucket.title = t;
        }

        const rowEmails = emailIdxs
          .filter((i) => !picked1to1.has(i))
          .map((i) => cell(r[i]))
          .filter(Boolean)
          .map((e) => e.toLowerCase());

        const rowPhones = phoneIdxs
          .filter((i) => !picked1to1.has(i))
          .map((i) => cell(r[i]))
          .filter(Boolean);

        bucket.emails.push(...rowEmails);
        bucket.phones.push(...rowPhones);
        aggByOrg.set(name, bucket);
      }

      // fetch existing orgs
      const names = [...orgMeta.keys()];
      const orgIdByName = new Map<string, number>();
      {
        const { data: existing } = await supabase
          .from("organizations")
          .select("id,name")
          .in("name", names);
        (existing ?? []).forEach((o) => orgIdByName.set(o.name as string, o.id as number));
      }

      // insert missing orgs
      const toCreate = names
        .filter((n) => !orgIdByName.has(n))
        .map((n) => ({ name: n, ...orgMeta.get(n)! }))
        .filter((r) => r.name && r.name.trim().length > 0);

      if (toCreate.length) {
        const { data: created, error } = await supabase
          .from("organizations")
          .insert(toCreate)
          .select("id,name");
        if (!error) (created ?? []).forEach((o) => orgIdByName.set(o.name as string, o.id as number));
      }

      // patch existing orgs
      const toPatch = names
        .filter((n) => orgIdByName.has(n))
        .map((n) => {
          const id = orgIdByName.get(n)!;
          const p = orgMeta.get(n)!;
          if (p.website || p.sector || p.city || p.country) {
            return { id, website: p.website ?? null, sector: p.sector ?? null, city: p.city ?? null, country: p.country ?? null };
          }
          return null;
        })
        .filter(Boolean) as Array<{ id: number; website: string|null; sector: string|null; city: string|null; country: string|null }>;
      if (toPatch.length) await supabase.from("organizations").upsert(toPatch);

      // preload contacts for all orgs we’ll touch (per-org de-dupe)
      const orgIds = [...orgIdByName.values()];
      const byOrgSets = new Map<number, { emails: Set<string>; phones: Set<string> }>();
      if (orgIds.length) {
        const { data } = await supabase
          .from("contacts")
          .select("org_id,email,phone")
          .in("org_id", orgIds);
        orgIds.forEach((id) => byOrgSets.set(id, { emails: new Set(), phones: new Set() }));
        (data ?? []).forEach((r) => {
          const s = byOrgSets.get(r.org_id as number)!;
          if (r.email) s.emails.add(String(r.email).toLowerCase());
          if (r.phone) s.phones.add(String(r.phone));
        });
      }

      // GLOBAL de-dupe (avoid unique constraint across the whole table)
      const { data: allContacts } = await supabase
        .from("contacts")
        .select("email,phone");
      const globalEmails = new Set<string>();
      const globalPhones = new Set<string>();
      (allContacts ?? []).forEach((r) => {
        if (r.email) globalEmails.add(String(r.email).toLowerCase());
        if (r.phone) globalPhones.add(String(r.phone));
      });
      const seenUploadEmails = new Set<string>();
      const seenUploadPhones = new Set<string>();

      // -------- pair by index PER ORG (across rows) --------
      const staged: any[] = [];
      for (const [name, bucket] of aggByOrg.entries()) {
        const orgId = orgIdByName.get(name);
        if (!orgId) continue;

        const sets = byOrgSets.get(orgId) ?? { emails: new Set<string>(), phones: new Set<string>() };
        byOrgSets.set(orgId, sets);

        const emails = Array.from(new Set(bucket.emails)).filter((e) => !sets.emails.has(e));
        const phones = Array.from(new Set(bucket.phones)).filter((p) => !sets.phones.has(p));

        const maxLen = Math.max(emails.length, phones.length);
        for (let i = 0; i < maxLen; i++) {
          let e = emails[i] ?? null;
          let p = phones[i] ?? null;

          // Skip anything that would violate global unique (or repeats in this upload)
          if (e && (globalEmails.has(e) || seenUploadEmails.has(e))) e = null;
          if (p && (globalPhones.has(p) || seenUploadPhones.has(p))) p = null;

          if (!e && !p) continue;

          staged.push({
            org_id: orgId,
            person_name: bucket.person || null,
            designation: bucket.title || null,
            email: e,
            phone: p,
          });

          if (e) { sets.emails.add(e); globalEmails.add(e); seenUploadEmails.add(e); }
          if (p) { sets.phones.add(p); globalPhones.add(p); seenUploadPhones.add(p); }
        }
      }
      // -----------------------------------------------------

      setPhase("importing");

      // bulk insert contacts
      const batches = chunk(staged, 1000);
      for (const b of batches) {
        if (!b.length) continue;
        const { error } = await supabase.from("contacts").insert(b);
        if (error) { alert(error.message || "Insert failed"); break; }
      }

      // close + refresh (realtime also kicks in)
      setOpen(false);
      setParsed(null);
      setFileName("");
      setRowsSpec("");
      setPhase("idle");
      router.refresh();
      onImported?.();
    } catch {
      setPhase("idle");
    } finally {
      setTimeout(detachRealtime, 800);
    }
  };

  const isBusy = phase !== "idle";
  const busyLabel = phase === "importing" ? "Importing…" : "Preparing…";

  /* ---------------------------------- UI ---------------------------------- */

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) { setPhase("idle"); detachRealtime(); }
      }}
    >
      <DialogTrigger asChild>{trigger ?? <Button>Bulk upload</Button>}</DialogTrigger>

      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-background z-10 pb-2">
          <DialogTitle>Bulk upload</DialogTitle>
        </DialogHeader>

        {!parsed ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="border border-dashed rounded-md p-8 text-center"
          >
            <p className="mb-2">Drag & drop a CSV or Excel (.xlsx) file here</p>
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            {fileName && <p className="mt-2 text-sm text-muted-foreground">{fileName}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Found <strong>{headers.length}</strong> headers and <strong>{rowCount}</strong> rows.
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium">Rows to import (optional)</label>
              <Input
                placeholder="e.g. 1-100, 205, 310-"
                value={rowsSpec}
                onChange={(e) => setRowsSpec(e.target.value)}
                disabled={isBusy}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <SingleSelectUnique label="Org name"  headers={headers} taken={takenAnywhere} selfValue={orgNameIdx}  onChange={setOrgNameIdx} required disabled={isBusy}/>
              <SingleSelectUnique label="Website"   headers={headers} taken={takenAnywhere} selfValue={websiteIdx}  onChange={setWebsiteIdx} disabled={isBusy}/>
              <SingleSelectUnique label="Sector"    headers={headers} taken={takenAnywhere} selfValue={sectorIdx}   onChange={setSectorIdx} disabled={isBusy}/>
              <SingleSelectUnique label="City"      headers={headers} taken={takenAnywhere} selfValue={cityIdx}     onChange={setCityIdx} disabled={isBusy}/>
              <SingleSelectUnique label="Country"   headers={headers} taken={takenAnywhere} selfValue={countryIdx}  onChange={setCountryIdx} disabled={isBusy}/>
              <SingleSelectUnique label="Person name" headers={headers} taken={takenAnywhere} selfValue={personIdx} onChange={setPersonIdx} disabled={isBusy}/>
              <SingleSelectUnique label="Designation" headers={headers} taken={takenAnywhere} selfValue={titleIdx}  onChange={setTitleIdx} disabled={isBusy}/>
            </div>

            <MultiCheckList
              title="Email columns (multi)"
              items={multiHeaders}
              selected={emailIdxs}
              onChange={setEmailIdxsSafe}
              extraHidden={new Set(phoneIdxs)}
              disabled={isBusy}
            />
            <MultiCheckList
              title="Number columns (multi)"
              items={multiHeaders}
              selected={phoneIdxs}
              onChange={setPhoneIdxsSafe}
              extraHidden={new Set(emailIdxs)}
              disabled={isBusy}
            />

            <div className="sticky bottom-0 bg-background pt-3 flex items-center justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setParsed(null)} disabled={isBusy}>
                Choose another file
              </Button>
              <Button onClick={doImport} disabled={!canImport || isBusy} aria-busy={isBusy}>
                {isBusy ? (
                  <span className="inline-flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {busyLabel}
                  </span>
                ) : (
                  "Import"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- UI building blocks --------------------------- */

function SingleSelectUnique({
  label, headers, taken, selfValue, onChange, required = false, disabled = false,
}: {
  label: string;
  headers: string[];
  taken: Set<number>;
  selfValue: number;
  onChange: (i: number) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const options = useMemo(
    () => headers.map((h, i) => ({ i, h })).filter(({ i }) => !taken.has(i) || i === selfValue),
    [headers, taken, selfValue]
  );

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <Select value={String(selfValue)} onValueChange={(v) => onChange(Number(v))} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={required ? "Choose…" : "— None —"} />
        </SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value="-1">— None —</SelectItem>}
          {options.map(({ i, h }) => (
            <SelectItem key={i} value={String(i)}>{h || `(col ${i + 1})`}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MultiCheckList({
  title, items, selected, onChange, extraHidden, disabled = false,
}: {
  title: string;
  items: { i: number; h: string; hidden: boolean }[];
  selected: number[];
  onChange: (next: number[]) => void;
  extraHidden?: Set<number>;
  disabled?: boolean;
}) {
  const visible = items.filter((x) => !x.hidden && !(extraHidden?.has(x.i)));
  const selSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (i: number) => {
    const next = new Set(selSet);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    onChange([...next].sort((a, b) => a - b));
  };

  const allIds = visible.map((x) => x.i);
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="mb-1 block text-sm font-medium">{title}</label>
        <div className="text-xs">
          <button className="underline mr-3" type="button" onClick={() => onChange(allIds)} disabled={disabled}>
            Select all
          </button>
          <button className="underline" type="button" onClick={() => onChange([])} disabled={disabled}>
            Clear
          </button>
        </div>
      </div>

      <div className="rounded-md border p-3 max-h-72 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No available columns.</p>
        ) : (
          <ul className="space-y-2">
            {visible.map(({ i, h }) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selSet.has(i)}
                  onChange={() => toggle(i)}
                  disabled={disabled}
                />
                <span className="text-sm">
                  {h || `(col ${i + 1})`} <span className="text-muted-foreground">(col {i + 1})</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
