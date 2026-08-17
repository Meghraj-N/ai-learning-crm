"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createModule, updateModule, type ActionState } from "./actions";

const TITLE_MAX = 200;

export function ModuleForm({
  courseId,
  moduleId,
  initialTitle,
}: {
  courseId: string;
  moduleId?: string;
  initialTitle?: string;
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
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
      >
        {isEdit ? "Edit" : "Add module"}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2"
    >
      <input type="hidden" name={isEdit ? "moduleId" : "courseId"} value={isEdit ? moduleId ?? "" : courseId} />
      <input
        type="text"
        name="title"
        required
        maxLength={TITLE_MAX}
        defaultValue={initialTitle ?? ""}
        placeholder="Module title"
        autoFocus
        className="min-w-52 flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : isEdit ? "Save" : "Add"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
      >
        Cancel
      </button>
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        {state.ok && (
          <span className="text-xs text-green-600">
            {isEdit ? "Saved." : "Module created."}
          </span>
        )}
      </form>
  );
}
