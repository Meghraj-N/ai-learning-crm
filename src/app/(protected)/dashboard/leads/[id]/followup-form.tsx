"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createFollowup, type ActionState } from "../actions";
import { FOLLOWUP_PRIORITIES } from "@/types/crm";
import type { OrgMember } from "@/types/crm";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function FollowupForm({
  leadId,
  members,
}: {
  leadId: string;
  members: OrgMember[];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    createFollowup,
    { ok: false, error: null }
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="sm:col-span-2 space-y-2">
        <label
          htmlFor="title"
          className="block text-[13px] font-medium text-[var(--color-text-primary)]"
        >
          Title <span className="text-[var(--color-danger)]">*</span>
        </label>
        <Input
          id="title"
          name="title"
          type="text"
          placeholder="e.g. Follow up on course enquiry"
          required
          disabled={isPending}
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor="dueAt"
          className="block text-[13px] font-medium text-[var(--color-text-primary)]"
        >
          Due date and time <span className="text-[var(--color-danger)]">*</span>
        </label>
        <Input
          id="dueAt"
          name="dueAt"
          type="datetime-local"
          required
          disabled={isPending}
          className="color-scheme-dark"
          style={{ colorScheme: 'dark' }}
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor="priority"
          className="block text-[13px] font-medium text-[var(--color-text-primary)]"
        >
          Priority
        </label>
        <select
          id="priority"
          name="priority"
          defaultValue="medium"
          disabled={isPending}
          className="flex h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition-colors focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {FOLLOWUP_PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label
          htmlFor="followupAssignedTo"
          className="block text-[13px] font-medium text-[var(--color-text-primary)]"
        >
          Assigned to
        </label>
        <select
          id="followupAssignedTo"
          name="assignedTo"
          defaultValue=""
          disabled={isPending}
          className="flex h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition-colors focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.full_name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2 space-y-2">
        <label
          htmlFor="followupNotes"
          className="block text-[13px] font-medium text-[var(--color-text-primary)]"
        >
          Notes
        </label>
        <textarea
          id="followupNotes"
          name="notes"
          rows={2}
          disabled={isPending}
          className="flex w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <div className="sm:col-span-2 flex items-center gap-3 mt-2">
        <Button
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Adding…" : "Add follow-up"}
        </Button>
        {state.error && (
          <span className="text-sm text-[var(--color-danger)]">{state.error}</span>
        )}
      </div>
    </form>
  );
}