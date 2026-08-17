"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createFollowup, type ActionState } from "../actions";
import { FOLLOWUP_PRIORITIES } from "@/types/crm";
import type { OrgMember } from "@/types/crm";

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
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="sm:col-span-2">
        <label
          htmlFor="title"
          className="block text-sm font-medium text-zinc-700"
        >
          Title <span className="text-red-600">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          placeholder="e.g. Follow up on course enquiry"
          required
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
        />
      </div>
      <div>
        <label
          htmlFor="dueAt"
          className="block text-sm font-medium text-zinc-700"
        >
          Due date and time <span className="text-red-600">*</span>
        </label>
        <input
          id="dueAt"
          name="dueAt"
          type="datetime-local"
          required
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
        />
      </div>
      <div>
        <label
          htmlFor="priority"
          className="block text-sm font-medium text-zinc-700"
        >
          Priority
        </label>
        <select
          id="priority"
          name="priority"
          defaultValue="medium"
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 disabled:opacity-50"
        >
          {FOLLOWUP_PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="followupAssignedTo"
          className="block text-sm font-medium text-zinc-700"
        >
          Assigned to
        </label>
        <select
          id="followupAssignedTo"
          name="assignedTo"
          defaultValue=""
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 disabled:opacity-50"
        >
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.full_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="followupNotes"
          className="block text-sm font-medium text-zinc-700"
        >
          Notes
        </label>
        <textarea
          id="followupNotes"
          name="notes"
          rows={2}
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
        />
      </div>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add follow-up"}
        </button>
        {state.error && (
          <span className="text-sm text-red-600">{state.error}</span>
        )}
      </div>
    </form>
  );
}