"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
  .refine(
    (v) => (v.email && v.email !== "") || (v.phone && v.phone !== ""),
    { path: ["email"], message: "Provide at least an email or a phone." }
  );

type FormValues = z.infer<typeof schema>;

export default function AddContactDialog({ orgId }: { orgId: number }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { person_name: "", designation: "", email: "", phone: "" },
  });

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) return;
    reset({ person_name: "", designation: "", email: "", phone: "" });
  };

  const onSubmit = async (v: FormValues) => {
    setSaving(true);

    const { error } = await supabase.from("contacts").insert({
      org_id: orgId,
      person_name: v.person_name?.trim() || null,
      designation: v.designation?.trim() || null,
      email: v.email ? v.email.trim() : null,
      phone: v.phone?.trim() || null,
      // IMPORTANT: do NOT touch any "last_update" here;
      // history is the only source-of-truth for activity.
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">Add contact</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
        </DialogHeader>

        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-sm font-medium">Name (optional)</label>
            <Input {...register("person_name")} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Designation (optional)</label>
            <Input {...register("designation")} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <Input type="email" placeholder="name@company.com" {...register("email")} />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Phone</label>
            <Input placeholder="01XXXXXXXXX" {...register("phone")} />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
