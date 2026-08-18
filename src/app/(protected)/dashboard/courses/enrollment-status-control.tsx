"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ENROLLMENT_TRANSITIONS, type EnrollmentStatus } from "@/types/crm";
import { updateEnrollmentStatus, type ActionState } from "./actions";

const BUTTON_LABELS: Partial<Record<EnrollmentStatus, string>> = {
  active: "Resume",
  paused: "Pause",
  completed: "Complete",
  cancelled: "Cancel",
};

export function EnrollmentStatusControl({
  enrollmentId,
  status,
}: {
  enrollmentId: string;
  status: EnrollmentStatus;
}) {
  const router = useRouter();
  const transitions = ENROLLMENT_TRANSITIONS[status];

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateEnrollmentStatus,
    { ok: false, error: null }
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  if (transitions.length === 0) {
    return null;
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      {transitions.map((target) => (
        <button
          key={target}
          type="submit"
          name="status"
          value={target}
          disabled={pending}
          className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-highest)] disabled:opacity-50"
        >
          {BUTTON_LABELS[target] ?? target}
        </button>
      ))}
      {!state.ok && state.error && (
        <span className="text-xs text-[var(--color-destructive)]">{state.error}</span>
      )}
    </form>
  );
}
