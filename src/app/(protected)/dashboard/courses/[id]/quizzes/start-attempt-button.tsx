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
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Starting…" : label ?? "Start attempt"}
      </button>
      {state.error && <p className="mt-2 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
