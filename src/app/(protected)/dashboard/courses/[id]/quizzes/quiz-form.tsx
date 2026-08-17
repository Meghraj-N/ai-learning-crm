"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createQuiz, updateQuiz, type RedirectActionState } from "./actions";

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;

export function QuizForm({
  courseId,
  quizId,
  initialTitle,
  initialDescription,
  initialThreshold,
  initialPublished,
}: {
  courseId: string;
  quizId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialThreshold?: number;
  initialPublished?: boolean;
}) {
  const router = useRouter();
  const isEdit = Boolean(quizId);
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    RedirectActionState,
    FormData
  >(isEdit ? updateQuiz : createQuiz, { ok: false, error: null });

  useEffect(() => {
    if (state.ok && state.redirect) {
      router.push(state.redirect);
    } else if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
      >
        {isEdit ? "Edit" : "Add quiz"}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-2 space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4"
    >
      <input
        type="hidden"
        name={isEdit ? "quizId" : "courseId"}
        value={isEdit ? quizId ?? "" : courseId}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          name="title"
          required
          maxLength={TITLE_MAX}
          defaultValue={initialTitle ?? ""}
          placeholder="Quiz title"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
        />
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="number"
            name="pass_threshold"
            min={0}
            max={100}
            step={1}
            required
            defaultValue={initialThreshold ?? 70}
            className="w-20 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
          />
          % to pass
        </label>
      </div>
      <textarea
        name="description"
        maxLength={DESCRIPTION_MAX}
        defaultValue={initialDescription ?? ""}
        placeholder="Description (optional)"
        rows={2}
        className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
      />
      <label className="flex items-center gap-2 text-sm text-zinc-600">
        <input
          type="checkbox"
          name="is_published"
          defaultChecked={initialPublished ?? false}
          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
        />
        Published
      </label>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create quiz"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
        >
          Cancel
        </button>
      </div>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
