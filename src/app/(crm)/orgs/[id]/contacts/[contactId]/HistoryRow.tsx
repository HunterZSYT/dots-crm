// src/app/(crm)/orgs/[id]/contacts/[contactId]/HistoryRow.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";

type Row = {
  id: number;
  event_at: string | null;
  medium: string | null;
  notes: string | null;
  follow_up_date: string | null;
  status: string | null;
};

export default function HistoryRow({ row, contactId }: { row: Row; contactId: number }) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // local state
  const [eventAt, setEventAt] = useState(row.event_at ?? new Date().toISOString());
  const [medium, setMedium] = useState(row.medium ?? "email");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [follow, setFollow] = useState(row.follow_up_date ?? "");
  const [status, setStatus] = useState(row.status ?? "follow_up_lead");

  const prettyDT = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : "—");
  const prettyD = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

  const onSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("contact_history")
      .update({
        event_at: eventAt,
        medium,
        notes: notes || null,
        follow_up_date: follow || null,
        status,
      })
      .eq("id", row.id)
      .eq("contact_id", contactId);
    setSaving(false);
    if (error) return alert(error.message);
    setOpen(false);
    router.refresh();
  };

  const onDelete = async () => {
    if (!confirm("Delete this history item?")) return;
    setDeleting(true);
    const { error } = await supabase
      .from("contact_history")
      .delete()
      .eq("id", row.id)
      .eq("contact_id", contactId);
    setDeleting(false);
    if (error) return alert(error.message);
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50">
          <TableCell>{prettyDT(row.event_at)}</TableCell>
          <TableCell>{row.medium ?? "—"}</TableCell>
          <TableCell>{prettyD(row.event_at)}</TableCell>
          <TableCell>{row.notes ?? "—"}</TableCell>
          <TableCell>{row.follow_up_date ?? "—"}</TableCell>
          <TableCell className="capitalize">{(row.status ?? "—").replaceAll("_", " ")}</TableCell>
        </TableRow>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit history</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Date & time</label>
            <Input
              type="datetime-local"
              value={new Date(eventAt).toISOString().slice(0, 16)}
              onChange={(e) => setEventAt(new Date(e.target.value).toISOString())}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Contact medium</label>
            <Select value={medium} onValueChange={(v) => setMedium(v)}>
              <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">email</SelectItem>
                <SelectItem value="phone">phone</SelectItem>
                <SelectItem value="meeting">meeting</SelectItem>
                <SelectItem value="other">other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What happened?" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Follow-up date</label>
              <Input
                type="date"
                value={follow || ""}
                onChange={(e) => setFollow(e.target.value || "")}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v)}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="follow_up_lead">Follow-Up Lead</SelectItem>
                  <SelectItem value="mail_sent">Mail-Sent</SelectItem>
                  <SelectItem value="meeting_fixed">Meeting Fixed</SelectItem>
                  <SelectItem value="dead_lead">Dead Lead</SelectItem>
                  <SelectItem value="ongoing_project">Ongoing project</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="destructive" onClick={onDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
