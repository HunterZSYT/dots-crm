// src/app/admin/page.tsx
import { requireOwnerOrSuper } from "@/lib/guards/requireOwnerOrSuper";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminPage() {
  await requireOwnerOrSuper();

  const admin = createAdminClient();

  // Read ALL roles (service role, no RLS)
  const { data: tmRows } = await admin.from("team_members").select("user_id, role");
  const roles = new Map<string, string>((tmRows ?? []).map((r: any) => [r.user_id, r.role]));

  // Auth users
  const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const users = usersList?.users ?? [];

  // Names from profiles
  const { data: profRows } = await admin.from("profiles").select("id, full_name");
  const names = new Map<string, string>((profRows ?? []).map((p: any) => [p.id, p.full_name]));

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Admin</h1>

      <table className="min-w-full border">
        <thead>
          <tr className="bg-muted/40">
            <th className="p-2 text-left">Email</th>
            <th className="p-2 text-left">User ID</th>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Role</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const role = roles.get(u.id) ?? "—";
            const fullName = names.get(u.id) ?? "";
            return (
              <tr key={u.id} className="border-t align-top">
                <td className="p-2">{u.email ?? "—"}</td>
                <td className="p-2">{u.id}</td>

                <td className="p-2">
                  <form method="post" action="/api/admin/set-name" className="flex items-center gap-2">
                    <input type="hidden" name="user_id" value={u.id} />
                    <input
                      name="full_name"
                      defaultValue={fullName}
                      placeholder="(no name)"
                      className="border rounded px-2 py-1 text-sm w-56"
                    />
                    <button type="submit" className="px-2 py-1 rounded border text-sm cursor-pointer hover:bg-muted">
                      Save
                    </button>
                  </form>
                </td>

                <td className="p-2">{role}</td>

                <td className="p-2 space-x-2">
                  {role === "—" ? (
                    <>
                      <form method="post" action="/api/admin/grant" className="inline">
                        <input type="hidden" name="user_id" value={u.id} />
                        <input type="hidden" name="role" value="member" />
                        <button className="px-2 py-1 rounded border cursor-pointer hover:bg-muted">Grant member</button>
                      </form>
                      <form method="post" action="/api/admin/grant" className="inline">
                        <input type="hidden" name="user_id" value={u.id} />
                        <input type="hidden" name="role" value="owner" />
                        <button className="px-2 py-1 rounded border cursor-pointer hover:bg-muted">Grant owner</button>
                      </form>
                    </>
                  ) : (
                    <form method="post" action="/api/admin/revoke" className="inline">
                      <input type="hidden" name="user_id" value={u.id} />
                      <button className="px-2 py-1 rounded border cursor-pointer hover:bg-destructive/10">Revoke</button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
