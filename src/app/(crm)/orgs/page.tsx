import { createClient as createServerSupabase } from "@/lib/supabase/server";
import AddOrg from "./AddOrg"; // ← import the client component

export default async function OrgsPage() {
  const supabase = await createServerSupabase();
  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id,name,created_at")
    .order("created_at", { ascending: false });

  if (error) return <pre className="p-4 text-red-600">{error.message}</pre>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Organizations</h1>
      <AddOrg /> {/* ← render it above the list */}
      <ul className="space-y-2">
        {(orgs ?? []).map((o) => (
          <li key={o.id} className="rounded border px-3 py-2">
            {o.name} <span className="text-xs text-gray-500">({o.created_at})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
