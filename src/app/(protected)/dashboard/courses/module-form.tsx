"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createModule, updateModule, type ActionState } from "./actions";

const TITLE_MAX = 200;

export function ModuleForm({
  courseId,
  moduleId,
  initialTitle,
  initialDescription,
}: {
  courseId: string;
  moduleId?: string;
  initialTitle?: string;
  initialDescription?: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(moduleId);
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    isEdit ? updateModule : createModule,
    { ok: false, error: null }
  );

  useEffect(() => {
    if (state.ok) {
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
        {isEdit ? "Edit" : "Add module"}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50 px-3 py-2"
    >
      <input type="hidden" name={isEdit ? "moduleId" : "courseId"} value={isEdit ? moduleId ?? "" : courseId} />
      <div className="flex flex-col gap-2 w-full">
        <input
          type="text"
          name="title"
          required
          maxLength={TITLE_MAX}
          defaultValue={initialTitle ?? ""}
          placeholder="Module title"
          autoFocus
          className="min-w-52 w-full rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
        />
        <textarea
          name="description"
          defaultValue={initialDescription ?? ""}
          placeholder="Module description (optional)"
          rows={3}
          className="min-w-52 w-full rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
      >
        {pending ? "Saving…" : isEdit ? "Save" : "Add"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-highest)]"
      >
        Cancel
      </button>
        {state.error && <span className="text-xs text-[var(--color-destructive)]">{state.error}</span>}
        {state.ok && (
          <span className="text-xs text-[var(--color-success)]">
            {isEdit ? "Saved." : "Module created."}
          </span>
        )}
      </form>
  );
}
