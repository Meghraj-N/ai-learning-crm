"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { assignLead, type ActionState } from "../actions";
import type { OrgMember } from "@/types/crm";
import { Button } from "@/components/ui/button";

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
        className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
      >
        <option value="">Unassigned</option>
        {members.map((member) => (
          <option key={member.user_id} value={member.user_id}>
            {member.full_name}
          </option>
        ))}
      </select>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={isPending}
      >
        {isPending ? "Saving…" : "Assign"}
      </Button>
      {state.error && <span className="text-sm text-[var(--color-danger)]">{state.error}</span>}
    </form>
  );
}