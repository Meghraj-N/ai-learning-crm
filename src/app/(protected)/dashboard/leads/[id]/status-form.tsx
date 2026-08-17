"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateLeadStatus, type ActionState } from "../actions";
import { LEAD_STATUSES, type LeadStatus } from "@/types/crm";

export default function StatusForm({
  leadId,
  currentStatus,
}: {
  leadId: string;
  currentStatus: LeadStatus;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    updateLeadStatus,
    { ok: false, error: null }
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  const options = LEAD_STATUSES.filter((value) => value !== "converted");

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="leadId" value={leadId} />
      <select
        name="status"
        defaultValue={currentStatus}
        disabled={isPending}
        className="rounded-md border border-[#272B33] bg-[#181B21] px-2 py-1.5 text-sm text-[#F4F4F5] shadow-sm outline-none focus:border-[#6366F1] disabled:opacity-50"
      >
        {options.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-[#272B33] bg-[#181B21] px-3 py-1.5 text-sm font-medium text-[#F4F4F5] transition-colors hover:bg-[#272B33] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Update status"}
      </button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}