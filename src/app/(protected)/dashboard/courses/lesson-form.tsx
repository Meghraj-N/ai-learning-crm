"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createLesson, updateLesson, type ActionState } from "./actions";

const TITLE_MAX = 200;
const CONTENT_MAX = 50000;

export function LessonForm({
  courseId,
  moduleId,
  lessonId,
  initialTitle,
  initialContent,
  initialPublished,
}: {
  courseId: string;
  moduleId: string;
  lessonId?: string;
  initialTitle?: string;
  initialContent?: string;
  initialPublished?: boolean;
}) {
  const router = useRouter();
  const isEdit = Boolean(lessonId);
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    isEdit ? updateLesson : createLesson,
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
        {isEdit ? "Edit" : "Add lesson"}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2"
    >
      <input
        type="hidden"
        name={isEdit ? "lessonId" : "moduleId"}
        value={isEdit ? lessonId ?? "" : moduleId}
      />
      {!isEdit && <input type="hidden" name="courseId" value={courseId} />}
      <input
        type="text"
        name="title"
        required
        maxLength={TITLE_MAX}
        defaultValue={initialTitle ?? ""}
        placeholder="Lesson title"
        autoFocus
        className="block w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
      />
      <textarea
        name="content"
        rows={4}
        maxLength={CONTENT_MAX}
        defaultValue={initialContent ?? ""}
        placeholder="Lesson content"
        className="block w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
      />
      {isEdit && (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="is_published"
            defaultChecked={initialPublished ?? false}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Published (visible to students)
        </label>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : isEdit ? "Save" : "Add lesson"}
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
            {isEdit ? "Saved." : "Lesson created."}
          </span>
        )}
      </div>
      {!isEdit && (
        <p className="text-xs text-zinc-400">
          New lessons are created unpublished and only become visible to students
          when you publish them.
        </p>
      )}
    </form>
  );
}
