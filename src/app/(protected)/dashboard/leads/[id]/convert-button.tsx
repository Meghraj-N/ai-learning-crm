"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { convertLead, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";

export default function ConvertButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState<
    ActionState & { studentId?: string },
    FormData
  >(convertLead, { ok: false, error: null });

  useEffect(() => {
    if (state.ok && state.studentId) {
      router.push(`/dashboard/students/${state.studentId}`);
    }
  }, [state, router]);

  if (!confirming) {
    return (
      <Button
        type="button"
        onClick={() => setConfirming(true)}
        className="bg-[var(--color-success)] text-white hover:bg-[var(--color-success)]/90"
      >
        Convert to Student
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="leadId" value={leadId} />
      <p className="text-sm text-[var(--color-text-secondary)]">
        Converting a lead creates a student record. Contact details are copied into the
        student record and the lead is marked as converted.
      </p>
      <Button
        type="submit"
        disabled={isPending}
        className="bg-[var(--color-success)] text-white hover:bg-[var(--color-success)]/90"
      >
        {isPending ? "Converting…" : "Confirm conversion"}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => setConfirming(false)}
        disabled={isPending}
      >
        Cancel
      </Button>
      {state.error && <span className="text-sm text-[var(--color-danger)]">{state.error}</span>}
    </form>
  );
}