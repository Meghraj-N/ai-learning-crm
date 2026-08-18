"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toggleActive, type ActionState } from "./actions";

export default function ActiveToggle({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    toggleActive,
    { ok: false, error: null }
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <button
        type="submit"
        disabled={isPending}
        className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          isActive
            ? "border-[var(--color-danger)]/20 text-[var(--color-destructive)] hover:bg-[var(--color-danger)]/10"
            : "border-[var(--color-success)]/20 text-[var(--color-success)] hover:bg-[var(--color-success)]/10"
        }`}
      >
        {isPending
          ? "Saving…"
          : isActive
            ? "Deactivate"
            : "Activate"}
      </button>
      {state.error && <span className="text-xs text-[var(--color-destructive)]">{state.error}</span>}
    </form>
  );
}