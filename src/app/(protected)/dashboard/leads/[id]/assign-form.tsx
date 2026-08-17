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
        name="assignedTo"
        defaultValue={currentAssignee ?? ""}
        disabled={isPending}
        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 disabled:opacity-50"
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
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Assign"}
      </button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}