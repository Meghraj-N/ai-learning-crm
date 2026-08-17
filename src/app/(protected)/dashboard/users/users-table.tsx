"use client";

import ProvisionForm from "./provision-form";
import RoleForm from "./role-form";
import ActiveToggle from "./active-toggle";
import type { UserRole } from "@/lib/roles";

export type UserRow = {
  user_id: string;
  organization_id: string | null;
  email: string;
  full_name: string;
  role: UserRole | null;
  is_active: boolean;
  created_at: string;
};

export default function UsersTable({
  users,
  orgName,
  ownUserId,
}: {
  users: UserRow[];
  orgName: string;
  ownUserId: string;
}) {
  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="w-full max-w-5xl">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Users
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage users in your organization.
        </p>
        <p className="mt-1 text-sm text-zinc-400">Organization: {orgName}</p>

        <div className="mt-8 overflow-x-auto rounded-md border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-500">Name</th>
                <th className="px-4 py-3 font-medium text-zinc-500">Email</th>
                <th className="px-4 py-3 font-medium text-zinc-500">Role</th>
                <th className="px-4 py-3 font-medium text-zinc-500">Status</th>
                <th className="px-4 py-3 font-medium text-zinc-500">Created</th>
                <th className="px-4 py-3 font-medium text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {users.map((user) => {
                const isSelf = user.user_id === ownUserId;
                return (
                  <tr key={user.user_id}>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {user.full_name}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{user.email}</td>
                    <td className="px-4 py-3 capitalize text-zinc-900">
                      {user.role ?? "Unprovisioned"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {user.created_at.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      {isSelf ? (
                        <span className="text-xs text-zinc-400">
                          Your account
                        </span>
                      ) : user.role === "admin" ? (
                        <span className="text-xs text-zinc-400">
                          Protected
                        </span>
                      ) : user.role === null ? (
                        <ProvisionForm userId={user.user_id} />
                      ) : (
                        <div className="flex flex-col items-start gap-1.5">
                          <RoleForm
                            userId={user.user_id}
                            currentRole={user.role}
                          />
                          <ActiveToggle
                            userId={user.user_id}
                            isActive={user.is_active}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}