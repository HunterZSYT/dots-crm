"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";

export default function AddOrg() {
  const [name, setName] = useState("");
  const supabase = createBrowserSupabase();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const { error } = await supabase.from("organizations").insert({ name: n });
    if (error) { alert(error.message); return; }
    setName("");
    router.refresh(); // re-renders your server page, no full reload
  }

  return (
    <form onSubmit={onSubmit} className="mb-4 flex gap-2">
      <input
        className="border rounded px-2 h-10"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Org name"
      />
      <button className="rounded bg-blue-600 px-3 py-1.5 text-white">
        Add
      </button>
    </form>
  );
}
