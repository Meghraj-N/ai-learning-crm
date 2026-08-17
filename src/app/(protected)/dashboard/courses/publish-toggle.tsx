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
            ? "border-amber-300 text-amber-700 hover:bg-amber-50"
            : "border-green-300 text-green-700 hover:bg-green-50"
        }`}
      >
        {pending ? "Saving…" : isPublished ? "Unpublish" : "Publish"}
      </button>
      {state.error && <span className="ml-2 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
