"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { startAttempt, type RedirectActionState } from "./actions";

export function StartAttemptButton({
  quizId,
  label,
}: {
  quizId: string;
  label?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    RedirectActionState,
    FormData
  >(startAttempt, { ok: false, error: null });

  useEffect(() => {
    if (state.ok && state.redirect) {
      router.push(state.redirect);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="quizId" value={quizId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
      >
        {pending ? "Starting…" : label ?? "Start attempt"}
      </button>
      {state.error && <p className="mt-2 text-xs text-[var(--color-destructive)]">{state.error}</p>}
    </form>
  );
}
