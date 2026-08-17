import { requireAdminContext } from "@/lib/admin";
import UsersTable, { type UserRow } from "./users-table";

export default async function UsersPage() {
  const ctx = await requireAdminContext();

  if (!ctx) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Access denied
          </h1>
          <div className="mt-8 rounded-md border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">
              Only administrators can manage users. If you believe this is an
              error, contact your administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { data: organization } = await ctx.supabase
    .from("organizations")
    .select("name")
    .eq("organization_id", ctx.organizationId)
    .maybeSingle<{ name: string }>();

  const { data: users, error } = await ctx.supabase
    .from("profiles")
    .select("user_id, organization_id, email, full_name, role, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("UsersPage: profile list failed", error.message);
  }

  return (
    <UsersTable
      users={(users ?? []) as UserRow[]}
      orgName={organization?.name ?? "—"}
      ownUserId={ctx.userId}
    />
  );
}