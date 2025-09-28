"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Org = {
  id: number;
  name: string;
  website: string | null;
  city: string | null;
  country: string | null;
  sector: string | null;
  last_event_at: string | null;
};

type Recent = {
  event_at: string | null;
  medium: string | null;
  status: string | null;
  notes_short: string | null;
};

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  website: z.string().trim().optional(),
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
  sector: z.string().trim().optional(),
});
type FormValues = z.infer<typeof schema>;

function normalizeUrl(v?: string | null) {
  if (!v) return null;
  const s = v.trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `https://${s}`;
}

function formatRecent(r?: Recent) {
  if (!r) return "—";
  const parts: string[] = [];
  if (r.medium) parts.push(r.medium);
  if (r.status) parts.push(r.status.replaceAll("_", " "));
  if (r.notes_short) parts.push(`“${r.notes_short}”`);
  if (r.event_at) parts.push(new Date(r.event_at).toLocaleDateString());
  return parts.join(" • ") || "—";
}

export default function OrgRow({
  org,
  recent,
  selectMode = false,
  selected = false,
  onSelectChange,
}: {
  org: Org;
  recent?: Recent;
  selectMode?: boolean;
  selected?: boolean;
  onSelectChange?: (checked: boolean) => void;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: org.name,
      website: org.website ?? "",
      city: org.city ?? "",
      country: org.country ?? "",
      sector: org.sector ?? "",
    },
  });

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    setConfirmingDelete(false);
    if (v) {
      reset({
        name: org.name,
        website: org.website ?? "",
        city: org.city ?? "",
        country: org.country ?? "",
        sector: org.sector ?? "",
      });
    }
  };

  const onSave = async (v: FormValues) => {
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        name: v.name.trim(),
        website: normalizeUrl(v.website),
        city: v.city?.trim() || null,
        country: v.country?.trim() || null,
        sector: v.sector?.trim() || null,
      })
      .eq("id", org.id);
    setSaving(false);
    if (error) return alert(error.message);
    setOpen(false);
    router.refresh();
  };

  const onDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("organizations").delete().eq("id", org.id);
    setDeleting(false);
    if (error) return alert(error.message);
    setOpen(false);
    router.refresh();
  };

  const websiteHref = normalizeUrl(org.website);
  const websiteLabel = org.website?.replace(/^https?:\/\//, "") ?? "—";
  const recentText = formatRecent(recent);

  const handleRowClick = () => {
    if (!selectMode) setOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={handleRowClick}>
        {selectMode && (
          <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelectChange?.(e.currentTarget.checked)}
              aria-label="Select row"
            />
          </TableCell>
        )}

        <TableCell className="font-medium whitespace-nowrap">{org.name}</TableCell>

        {/* fixed width so ellipsis works with table-fixed */}
        <TableCell className="w-[280px] max-w-[280px] truncate">
          {websiteHref ? (
            <a
              href={websiteHref}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hover:underline"
              title={websiteHref}
            >
              {websiteLabel}
            </a>
          ) : (
            "—"
          )}
        </TableCell>

        <TableCell className="whitespace-nowrap">{org.city ?? "—"}</TableCell>
        <TableCell className="whitespace-nowrap">{org.country ?? "—"}</TableCell>
        <TableCell className="whitespace-nowrap">{org.sector ?? "—"}</TableCell>

        <TableCell className="whitespace-nowrap">
          {org.last_event_at ? "Active" : "Fresh"}
        </TableCell>

        <TableCell className="w-[360px] max-w-[360px] truncate">{recentText}</TableCell>

        <TableCell className="w-[130px] text-right">
          <Button size="sm" asChild onClick={(e) => e.stopPropagation()}>
            <Link href={`/orgs/${org.id}/contacts`}>Contacts DB</Link>
          </Button>
        </TableCell>
      </TableRow>

      {/* edit modal */}
      <DialogContent className="sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Edit organization</DialogTitle>
        </DialogHeader>

        <form className="space-y-3" onSubmit={handleSubmit(onSave)}>
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <Input {...register("name")} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Website</label>
            <Input placeholder="example.com or https://example.com" {...register("website")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">City</label>
              <Input {...register("city")} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Country</label>
              <Input {...register("country")} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Sector</label>
            <Input {...register("sector")} />
          </div>

          <p className="text-xs text-muted-foreground">
            Status is computed from the most recent activity in contact history.
          </p>

          <div className="flex items-center justify-between pt-3">
            {!confirmingDelete ? (
              <Button type="button" variant="destructive" onClick={() => setConfirmingDelete(true)}>
                Delete
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Delete this organization?</span>
                <Button type="button" variant="secondary" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
                <Button type="button" variant="destructive" onClick={onDelete} disabled={deleting}>
                  {deleting ? "Deleting…" : "Yes, delete"}
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function timeAgo(iso: string) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const s = Math.max(1, Math.floor((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
