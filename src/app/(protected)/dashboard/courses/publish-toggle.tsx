"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toggleLessonPublished, type ActionState } from "./actions";

export function PublishToggle({
  lessonId,
  isPublished,
}: {
  lessonId: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    toggleLessonPublished,
    { ok: false, error: null }
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="lessonId" value={lessonId} />
      <button
        type="submit"
        disabled={pending}
        className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
          isPublished
            ? "border-[var(--color-warning)]/20 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10"
            : "border-[var(--color-success)]/20 text-[var(--color-success)] hover:bg-[var(--color-success)]/10"
        }`}
      >
        {pending ? "Saving…" : isPublished ? "Unpublish" : "Publish"}
      </button>
      {state.error && <span className="ml-2 text-xs text-[var(--color-destructive)]">{state.error}</span>}
    </form>
  );
}
