"use client";

import ProvisionForm from "./provision-form";
import RoleForm from "./role-form";
import ActiveToggle from "./active-toggle";
import type { UserRole } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
    <div className="flex flex-1 flex-col pb-12 w-full animate-in fade-in duration-500 max-w-6xl mx-auto px-4 mt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#F4F4F5]">
            Users
          </h1>
          <p className="mt-2 text-sm text-[#A1A1AA]">
            Manage users in your organization.
          </p>
          <p className="mt-1 text-sm font-medium text-[#71717A]">
            Organization: <span className="text-[#F4F4F5]">{orgName}</span>
          </p>
        </div>
      </div>

      <Card className="bg-[#111318] border-[#272B33]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#181B21]/50 border-b border-[#272B33]">
              <TableRow className="hover:bg-transparent border-transparent">
                <TableHead className="text-[#A1A1AA] font-medium h-12">Name</TableHead>
                <TableHead className="text-[#A1A1AA] font-medium h-12">Email</TableHead>
                <TableHead className="text-[#A1A1AA] font-medium h-12">Role</TableHead>
                <TableHead className="text-[#A1A1AA] font-medium h-12">Status</TableHead>
                <TableHead className="text-[#A1A1AA] font-medium h-12">Created</TableHead>
                <TableHead className="text-[#A1A1AA] font-medium h-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isSelf = user.user_id === ownUserId;
                return (
                  <TableRow key={user.user_id} className="border-[#272B33] hover:bg-[#181B21]/50 group transition-colors">
                    <TableCell className="py-4 font-medium text-[#F4F4F5]">
                      {user.full_name}
                    </TableCell>
                    <TableCell className="py-4 text-[#A1A1AA]">{user.email}</TableCell>
                    <TableCell className="py-4">
                      <span className="capitalize text-[#F4F4F5] font-medium">
                        {user.role ?? "Unprovisioned"}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      {user.is_active ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-zinc-500/10 text-zinc-500 border-zinc-500/20">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-4 text-sm text-[#71717A]">
                      {new Date(user.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}
                    </TableCell>
                    <TableCell className="py-4">
                      {isSelf ? (
                        <span className="text-xs font-medium text-[#71717A] bg-[#272B33]/50 px-2.5 py-1 rounded-md">
                          Your account
                        </span>
                      ) : user.role === "admin" ? (
                        <span className="text-xs font-medium text-[#71717A] bg-[#272B33]/50 px-2.5 py-1 rounded-md">
                          Protected
                        </span>
                      ) : user.role === null ? (
                        <ProvisionForm userId={user.user_id} />
                      ) : (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
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
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}