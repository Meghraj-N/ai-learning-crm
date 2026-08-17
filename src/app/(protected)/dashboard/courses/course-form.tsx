"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { COURSE_STATUSES, type CourseStatus } from "@/types/crm";
import { createCourse, updateCourse } from "./actions";

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;

export function CourseForm({
  courseId,
  initialTitle,
  initialDescription,
  initialStatus,
}: {
  courseId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialStatus?: CourseStatus;
}) {
  const router = useRouter();
  const isEdit = Boolean(courseId);

  const [state, formAction, pending] = useActionState(
    isEdit ? updateCourse : createCourse,
    { ok: false, error: null }
  );

  return (
    <form
      action={(formData) => {
        if (courseId) {
          formData.set("courseId", courseId);
        }
        formAction(formData);
      }}
      className="mt-6 space-y-4"
    >
      {state.ok && state.error === null && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm text-green-700">
            {isEdit ? "Course updated." : "Course created."}
          </p>
        </div>
      )}
      {!state.ok && state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}

      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-zinc-700"
        >
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={TITLE_MAX}
          defaultValue={initialTitle ?? ""}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-zinc-700"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={DESCRIPTION_MAX}
          defaultValue={initialDescription ?? ""}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
        />
        <p className="mt-1 text-xs text-zinc-400">
          Shown on the course card and detail page.
        </p>
      </div>

      <div>
        <label
          htmlFor="status"
          className="block text-sm font-medium text-zinc-700"
        >
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={initialStatus ?? "draft"}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500"
        >
          {COURSE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-400">
          Published courses are visible to students.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending
          ? "Saving…"
          : isEdit
            ? "Save changes"
            : "Create course"}
      </button>

      {state.ok && state.error === null && !isEdit && "courseId" in state && (
        <button
          type="button"
          onClick={() =>
            router.push(
              `/dashboard/courses/${(state as { courseId?: string }).courseId}`
            )
          }
          className="ml-3 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
        >
          View course
        </button>
      )}
    </form>
  );
}
