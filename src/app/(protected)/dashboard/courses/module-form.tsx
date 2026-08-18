"use client";

import { useActionState, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { createModule, updateModule, type ActionState } from "./actions";

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 500;

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
    async (prevState: ActionState, formData: FormData) => {
      const result = isEdit
        ? await updateModule(prevState, formData)
        : await createModule(prevState, formData);

      if (result.ok) {
        router.refresh();
        if (!isEdit) setOpen(false);
      }
      return result;
    },
    { ok: false, error: null }
  );

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
      className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50 p-3"
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
          className="min-w-52 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] bg-[var(--color-surface)]"
        />
        <Textarea
          name="description"
          defaultValue={initialDescription ?? ""}
          placeholder="Module description (optional)"
          maxLength={DESCRIPTION_MAX}
          rows={3}
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
