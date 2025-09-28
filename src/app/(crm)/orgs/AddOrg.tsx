"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { withLock } from "@/lib/locks";

export default function AddOrg() {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const supabase = createBrowserSupabase();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n || pending) return;

    setPending(true);
    await withLock("org:add", async () => {
      const { error } = await supabase
        .from("organizations")
        .insert({ name: n })
        .select()
        .single();

      if (error) {
        alert(error.message);
        return;
      }

      setName("");
      router.refresh(); // re-render list
    }).finally(() => setPending(false));
  }

  return (
    <form onSubmit={onSubmit} className="mb-4 flex gap-2">
      <input
        className="border rounded px-2 h-10"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Org name"
        disabled={pending}
      />
      <button
        className="rounded bg-blue-600 px-3 py-1.5 text-white disabled:opacity-60"
        disabled={pending}
      >
        {pending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
