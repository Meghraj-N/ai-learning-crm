"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { moveLesson, moveModule, type ActionState } from "./actions";
import { moveQuestion, type ActionState as QuizActionState } from "./[id]/quizzes/actions";

export function OrderControls({
  kind,
  itemId,
  position,
  total,
}: {
  kind: "module" | "lesson" | "question";
  itemId: string;
  position: number;
  total: number;
}) {
  const router = useRouter();
  const action =
    kind === "module" ? moveModule : kind === "lesson" ? moveLesson : moveQuestion;
  const [state, formAction, pending] = useActionState<
    ActionState | QuizActionState,
    FormData
  >(action, { ok: false, error: null });

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  const name =
    kind === "module" ? "moduleId" : kind === "lesson" ? "lessonId" : "questionId";
  const buttonClass =
    "rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex items-center gap-1">
      <form action={formAction} className="inline">
        <input type="hidden" name={name} value={itemId} />
        <input type="hidden" name="direction" value="up" />
        <button
          type="submit"
          disabled={pending || position <= 1}
          aria-label="Move up"
          className={buttonClass}
        >
          ↑
        </button>
      </form>
      <form action={formAction} className="inline">
        <input type="hidden" name={name} value={itemId} />
        <input type="hidden" name="direction" value="down" />
        <button
          type="submit"
          disabled={pending || position >= total}
          aria-label="Move down"
          className={buttonClass}
        >
          ↓
        </button>
      </form>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </div>
  );
}
