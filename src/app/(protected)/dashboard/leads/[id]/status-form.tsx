"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateLeadStatus, type ActionState } from "../actions";
import { LEAD_STATUSES, type LeadStatus } from "@/types/crm";
import { Button } from "@/components/ui/button";

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
        className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
      >
        {options.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={isPending}
      >
        {isPending ? "Saving…" : "Update status"}
      </Button>
      {state.error && <span className="text-sm text-[var(--color-danger)]">{state.error}</span>}
    </form>
  );
}