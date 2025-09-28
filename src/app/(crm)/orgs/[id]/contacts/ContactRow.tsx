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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Contact = {
  id: number;
  person_name: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  last_update: string | null; // kept in type, but we don't write to it
};

const schema = z
  .object({
    person_name: z.string().trim().optional(),
    designation: z.string().trim().optional(),
    email: z
      .string()
      .trim()
      .email("Invalid email")
      .optional()
      .or(z.literal("")),
    phone: z.string().trim().optional().or(z.literal("")),
  })
  // Must provide at least one of email or phone
  .refine((v) => (v.email && v.email !== "") || (v.phone && v.phone !== ""), {
    path: ["email"],
    message: "Provide at least an email or a phone.",
  });

type FormValues = z.infer<typeof schema>;

export default function ContactRow({
  orgId,
  contact,
  summary, // ← string for "Last update" column
}: {
  orgId: number;
  contact: Contact;
  summary?: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      person_name: contact.person_name ?? "",
      designation: contact.designation ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
    },
  });

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    setConfirmingDelete(false);
    if (v) {
      reset({
        person_name: contact.person_name ?? "",
        designation: contact.designation ?? "",
        email: contact.email ?? "",
        phone: contact.phone ?? "",
      });
    }
  };

  const onSave = async (v: FormValues) => {
    setSaving(true);

    const { error } = await supabase
      .from("contacts")
      .update({
        person_name: v.person_name?.trim() || null,
        designation: v.designation?.trim() || null,
        email: v.email ? v.email.trim() : null,
        phone: v.phone?.trim() || null,
        // IMPORTANT: do NOT set any last_update here — the page shows the latest history summary
      })
      .eq("id", contact.id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }
    setOpen(false);
    router.refresh();
  };

  const onDelete = async () => {
    setDeleting(true);
    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", contact.id);
    setDeleting(false);

    if (error) {
      alert(error.message);
      return;
    }
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The whole row opens the edit dialog */}
      <DialogTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50">
          <TableCell>{contact.person_name || "—"}</TableCell>
          <TableCell>{contact.designation || "—"}</TableCell>
          <TableCell>{contact.email || "—"}</TableCell>
          <TableCell>{contact.phone || "—"}</TableCell>
          <TableCell>{summary ?? "—"}</TableCell>
          <TableCell className="text-right">
            <Button size="sm" asChild onClick={(e) => e.stopPropagation()}>
              <Link href={`/orgs/${orgId}/contacts/${contact.id}`}>History</Link>
            </Button>
          </TableCell>
        </TableRow>
      </DialogTrigger>

      {/* Edit / Delete modal */}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit contact</DialogTitle>
        </DialogHeader>

        <form className="space-y-3" onSubmit={handleSubmit(onSave)}>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Name (optional)
            </label>
            <Input {...register("person_name")} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Designation (optional)
            </label>
            <Input {...register("designation")} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <Input type="email" {...register("email")} />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Phone</label>
            <Input {...register("phone")} />
          </div>

          <div className="flex items-center justify-between pt-3">
            {!confirmingDelete ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Delete this contact?
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={onDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
              >
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
