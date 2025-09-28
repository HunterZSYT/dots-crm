"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** ────────────────────────────────────────────────────────────────
 *  Status values you asked for (contact history):
 *  follow_up_lead, mail_sent, meeting_fixed, dead_lead, ongoing_project
 *  ─────────────────────────────────────────────────────────────── */
const HISTORY_STATUS = [
  "follow_up_lead",
  "mail_sent",
  "meeting_fixed",
  "dead_lead",
  "ongoing_project",
] as const;
type HistoryStatus = typeof HISTORY_STATUS[number];

const schema = z.object({
  event_at: z.string().min(1), // ISO string
  medium: z.enum(["email", "phone", "meeting", "other"]).default("email"),
  notes: z.string().optional(),
  follow_up_date: z.string().optional(), // YYYY-MM-DD
  status: z.enum(HISTORY_STATUS).default("follow_up_lead"),
});
type FormValues = z.infer<typeof schema>;

export default function AddHistoryDialog({ contactId }: { contactId: number }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      event_at: new Date().toISOString(),
      medium: "email",
      notes: "",
      follow_up_date: "",
      status: "follow_up_lead",
    },
  });

  const onSubmit = async (v: FormValues) => {
    const { error } = await supabase.from("contact_history").insert({
      contact_id: contactId,
      event_at: v.event_at,
      medium: v.medium,                // column name is "medium"
      notes: v.notes || null,
      follow_up_date: v.follow_up_date || null,
      status: v.status,                // enum: follow_up_lead | mail_sent | meeting_fixed | dead_lead | ongoing_project
    });
    if (error) {
      alert(error.message);
      return;
    }
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add history</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add history</DialogTitle>
        </DialogHeader>

        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-sm font-medium">Date &amp; time</label>
            <Input
              type="datetime-local"
              value={new Date(watch("event_at")).toISOString().slice(0, 16)}
              onChange={(e) => setValue("event_at", new Date(e.target.value).toISOString())}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Contact medium</label>
            <Select value={watch("medium")} onValueChange={(v) => setValue("medium", v as any)}>
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
            <Input {...register("notes")} placeholder="What happened?" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Follow-up date</label>
              <Input
                type="date"
                value={watch("follow_up_date") || ""}
                onChange={(e) => setValue("follow_up_date", e.target.value || undefined)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as HistoryStatus)}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="follow_up_lead">Follow-up lead</SelectItem>
                  <SelectItem value="mail_sent">Mail sent</SelectItem>
                  <SelectItem value="meeting_fixed">Meeting fixed</SelectItem>
                  <SelectItem value="dead_lead">Dead lead</SelectItem>
                  <SelectItem value="ongoing_project">Ongoing project</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
