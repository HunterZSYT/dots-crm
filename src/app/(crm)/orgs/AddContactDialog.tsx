"use client";

import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const schema = z.object({
  person_name: z.string().min(2, "Name is too short"),
  designation: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function AddContactDialog({ orgId }: { orgId: number }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { person_name: "", designation: "", email: "", phone: "" },
  });

  async function onSubmit(values: FormValues) {
    const { error } = await supabase.from("contacts").insert({
      org_id: orgId,
      person_name: values.person_name.trim(),
      designation: values.designation || null,
      email: values.email ? values.email : null,
      phone: values.phone || null,
    });
    if (error) { alert(error.message); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add entry</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
        </DialogHeader>

        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Person Name</label>
            <Input {...register("person_name")} placeholder="Jane Doe" />
            {errors.person_name && <p className="text-xs text-red-600">{errors.person_name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Designation</label>
            <Input {...register("designation")} placeholder="CTO / BD / …" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <Input {...register("email")} placeholder="jane@company.com" />
            {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Number</label>
            <Input {...register("phone")} placeholder="+1 555 0123" />
          </div>

          <div className="pt-2 flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
