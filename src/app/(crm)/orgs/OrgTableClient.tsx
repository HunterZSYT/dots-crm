// src/app/(crm)/orgs/OrgTableClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";

import FilterHead from "./FilterHead";
import OrgRow from "./OrgRow";
import BulkUploadDialog from "./bulk-upload/BulkUploadDialog";

/* ---------- Types ---------- */

type Org = {
  id: number;
  name: string;
  website: string | null;
  city: string | null;
  country: string | null;
  sector: string | null;
  last_event_at: string | null;
};

type LatestEvent = {
  org_id: number;
  event_at: string | null;
  medium: string | null;
  status: string | null;
  notes_short: string | null;
};

type Row = { org: Org; recent?: LatestEvent };

type FiltersPayload = {
  selected: {
    city?: string[] | string;
    country?: string[] | string;
    sector?: string[] | string;
    status?: string[] | string;
  };
  options: {
    cities?: string[];
    countries?: string[];
    sectors?: string[];
    statuses?: string[];
  };
};

function toArr(v?: string[] | string | null): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

/* ---------- Component ---------- */

export default function OrgTableClient({
  orgs,
  filters,
}: {
  orgs: Row[];
  filters: FiltersPayload;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // bulk delete UX
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const visibleIds = useMemo(() => orgs.map((r) => r.org.id), [orgs]);

  const allSelectedOnPage = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id)),
    [visibleIds, selectedIds]
  );
  const someSelectedOnPage = useMemo(
    () => visibleIds.some((id) => selectedIds.has(id)) && !allSelectedOnPage,
    [visibleIds, selectedIds, allSelectedOnPage]
  );

  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelectedOnPage;
    }
  }, [someSelectedOnPage]);

  const toggleRow = (id: number, checked?: boolean) =>
    setSelectedIds((s) => {
      const n = new Set(s);
      const next = checked ?? !n.has(id);
      if (next) n.add(id);
      else n.delete(id);
      return n;
    });

  const toggleAllOnPage = (checked: boolean) =>
    setSelectedIds((s) => {
      const n = new Set(s);
      if (checked) visibleIds.forEach((id) => n.add(id));
      else visibleIds.forEach((id) => n.delete(id));
      return n;
    });

  const exitSelect = () => {
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const deleteSelected = async () => {
    if (!selectedIds.size) return;
    if (
      !confirm(
        `Delete ${selectedIds.size} organization(s)? This cannot be undone.`
      )
    )
      return;

    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("organizations")
      .delete()
      .in("id", ids);
    if (error) {
      alert(error.message);
      return;
    }
    exitSelect();
    router.refresh();
  };

  // --- status normalization so "fresh" in URL matches "Fresh" option ---
  const statusOptions = filters.options.statuses ?? [];
  const statusSelected = useMemo(() => {
    const wanted = toArr(filters.selected.status).map(String);
    if (!wanted.length) return wanted;
    return wanted
      .map(
        (v) => statusOptions.find((o) => o.toLowerCase() === v.toLowerCase()) ?? v
      )
      .filter(Boolean);
  }, [filters.selected.status, statusOptions]);

  // convenience for other filters (already arrays in page.tsx)
  const citySelected = toArr(filters.selected.city);
  const countrySelected = toArr(filters.selected.country);
  const sectorSelected = toArr(filters.selected.sector);

  /* ---------- Download CSV (no Google sync) ---------- */
  const onDownloadCSV = () => {
    const q = searchParams?.toString() ?? "";
    window.location.href = q ? `/api/orgs/export?${q}` : `/api/orgs/export`;
  };

  return (
    <div className="p-6 space-y-4">
      {/* header actions */}
      <div className="flex items-center justify-end gap-2">
        {/* Global Analytics page button */}
        <Button asChild variant="secondary">
          <Link href="/orgs/analytics">Analytics</Link>
        </Button>

        <Button asChild variant="default">
          <Link href="/orgs/new">Add entry</Link>
        </Button>

        <BulkUploadDialog onImported={() => router.refresh()} />

        <Button variant="outline" onClick={onDownloadCSV}>
          Download CSV
        </Button>

        {!selectMode ? (
          <Button variant="secondary" onClick={() => setSelectMode(true)}>
            Bulk delete
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={exitSelect}>
              Exit select
            </Button>
            <Button
              variant="destructive"
              onClick={deleteSelected}
              disabled={selectedIds.size === 0}
            >
              Delete selected ({selectedIds.size})
            </Button>
          </>
        )}
      </div>

      {/* table wrapper enables horizontal scroll on very small screens */}
      <div className="overflow-x-auto">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              {selectMode && (
                <TableHead className="w-10">
                  <input
                    ref={headerCheckboxRef}
                    aria-label="Select all rows on this page"
                    type="checkbox"
                    checked={allSelectedOnPage}
                    onChange={(e) => toggleAllOnPage(e.currentTarget.checked)}
                  />
                </TableHead>
              )}

              <TableHead className="min-w-[220px] whitespace-nowrap">
                Org name
              </TableHead>

              {/* Fix website column width so truncation works */}
              <TableHead className="w-[280px] whitespace-nowrap">
                Website
              </TableHead>

              <TableHead className="w-[120px] whitespace-nowrap">
                <div className="inline-flex items-center gap-1">
                  <span>City</span>
                  <FilterHead
                    label="City"
                    param="city"
                    options={filters.options.cities ?? []}
                    selected={citySelected}
                    allLabel="All cities"
                  />
                </div>
              </TableHead>

              <TableHead className="w-[200px] whitespace-nowrap">
                <div className="inline-flex items-center gap-1">
                  <span>Country</span>
                  <FilterHead
                    label="Country"
                    param="country"
                    options={filters.options.countries ?? []}
                    selected={countrySelected}
                    allLabel="All countries"
                  />
                </div>
              </TableHead>

              <TableHead className="w-[160px] whitespace-nowrap">
                <div className="inline-flex items-center gap-1">
                  <span>Sector</span>
                  <FilterHead
                    label="Sector"
                    param="sector"
                    options={filters.options.sectors ?? []}
                    selected={sectorSelected}
                    allLabel="All sectors"
                  />
                </div>
              </TableHead>

              <TableHead className="w-[100px] whitespace-nowrap">
                <div className="inline-flex items-center gap-1">
                  <span>Status</span>
                  <FilterHead
                    label="Status"
                    param="status"
                    options={statusOptions}
                    selected={statusSelected}
                    allLabel="All status"
                  />
                </div>
              </TableHead>

              {/* make recent events truncate nicely */}
              <TableHead className="w-[360px] whitespace-nowrap">
                Recent events
              </TableHead>

              <TableHead className="w-[130px] text-right whitespace-nowrap">
                Contacts DB
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {orgs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={selectMode ? 9 : 8}
                  className="text-center text-sm text-muted-foreground"
                >
                  No organizations found.
                </TableCell>
              </TableRow>
            ) : (
              orgs.map(({ org, recent }) => (
                <OrgRow
                  key={org.id}
                  org={org}
                  recent={recent}
                  selectMode={selectMode}
                  selected={selectedIds.has(org.id)}
                  onSelectChange={(checked) => toggleRow(org.id, checked)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
