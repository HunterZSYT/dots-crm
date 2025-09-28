"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { STATUS_VALUES, STATUS_OPTIONS, LeadStatus } from "./status";

const schema = z.object({
  name: z.string().min(2, "Name is too short"),
  sector: z.string().optional().transform((v) => v ?? ""),
  status: z.enum(STATUS_VALUES).default("new"),
});
type FormValues = z.infer<typeof schema>;

export default function AddOrgDialog() {
  const router = useRouter();
  const supabase = createClient();
  const form = useForm<FormValues>({
    resolver: zodResolver<FormValues>(schema),
    defaultValues: { name: "", sector: "", status: "new" as LeadStatus },
  });

  async function onSubmit(values: FormValues) {
    const { error } = await supabase.from("organizations").insert({
      name: values.name.trim(),
      sector: values.sector?.trim() || null,
      status: values.status,
    });
    if (error) return alert(error.message);
    form.reset();
    setOpen(false);
    router.refresh();
  }

  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add entry</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add organization</DialogTitle>
          <DialogDescription>Create a new lead / org entry.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Name</label>
            <Input {...form.register("name")} placeholder="Organization name" />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm mb-1">Sector</label>
            <Input {...form.register("sector")} placeholder="e.g. Software" />
          </div>

          <div>
            <label className="block text-sm mb-1">Status</label>
            <Select
              value={form.watch("status")}
              onValueChange={(v: LeadStatus) => form.setValue("status", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import * as React from "react";
