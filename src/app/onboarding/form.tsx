"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function OnboardingForm() {
  const sb = createClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { error } = await sb.from("profiles").upsert({ id: user.id, full_name: name.trim() });
    setSaving(false);
    if (error) return alert(error.message);
    router.push("/no-access");
  };

  return (
    <div className="space-y-3">
      <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
      <Button onClick={save} disabled={!name.trim() || saving}>
        {saving ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}
