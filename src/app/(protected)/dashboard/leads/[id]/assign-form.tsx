"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { assignLead, type ActionState } from "../actions";
import type { OrgMember } from "@/types/crm";

export default function AssignForm({
  leadId,
  currentAssignee,
  members,
}: {
  leadId: string;
  currentAssignee: string | null;
  members: OrgMember[];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    assignLead,
    { ok: false, error: null }
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="leadId" value={leadId} />
      <select
        name="assigned_to"
        defaultValue={currentAssignee ?? ""}
        disabled={isPending}
        className="rounded-md border border-[#272B33] bg-[#181B21] px-2 py-1.5 text-sm text-[#F4F4F5] shadow-sm outline-none focus:border-[#6366F1] disabled:opacity-50"
      >
        <option value="">Unassigned</option>
        {members.map((member) => (
          <option key={member.user_id} value={member.user_id}>
            {member.full_name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-[#272B33] bg-[#181B21] px-3 py-1.5 text-sm font-medium text-[#F4F4F5] transition-colors hover:bg-[#272B33] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Assign"}
      </button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}