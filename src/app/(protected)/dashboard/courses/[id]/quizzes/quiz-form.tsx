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
        className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-highest)]"
      >
        {isEdit ? "Edit" : "Add quiz"}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-2 space-y-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50 p-4"
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
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
        />
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input
            type="number"
            name="pass_threshold"
            min={0}
            max={100}
            step={1}
            required
            defaultValue={initialThreshold ?? 70}
            className="w-20 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
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
        className="w-full rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
      />
      <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
        <input
          type="checkbox"
          name="is_published"
          defaultChecked={initialPublished ?? false}
          className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-text-primary)] focus:ring-[var(--color-primary)]"
        />
        Published
      </label>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create quiz"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-highest)]"
        >
          Cancel
        </button>
      </div>
      {state.error && <p className="text-xs text-[var(--color-destructive)]">{state.error}</p>}
    </form>
  );
}
