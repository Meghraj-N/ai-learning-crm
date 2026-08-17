"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createEnrollment, type EnrollmentActionState } from "./actions";

export type StudentOption = {
  student_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
};

export function EnrollStudentForm({
  courseId,
  students,
}: {
  courseId: string;
  students: StudentOption[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    EnrollmentActionState,
    FormData
  >(createEnrollment, { ok: false, error: null });

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="courseId" value={courseId} />
      <div className="min-w-64 flex-1 basis-64">
        <label
          htmlFor="studentId"
          className="block text-sm font-medium text-zinc-700"
        >
          Student
        </label>
        <select
          id="studentId"
          name="studentId"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
        >
          <option value="">Select a student…</option>
          {students.map((student) => (
            <option key={student.student_id} value={student.student_id}>
              {student.first_name} {student.last_name}
              {student.email ? ` (${student.email})` : ""}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Enrolling…" : "Enroll student"}
      </button>

      {state.ok && state.error === null && (
        <div className="w-full">
          <div
            className={`rounded-md border px-4 py-3 ${
              state.alreadyEnrolled
                ? "border-amber-200 bg-amber-50"
                : "border-green-200 bg-green-50"
            }`}
          >
            <p
              className={`text-sm ${
                state.alreadyEnrolled ? "text-amber-700" : "text-green-700"
              }`}
            >
              {state.alreadyEnrolled
                ? "This student already has an open enrollment in this course."
                : "Student enrolled. The course now starts as active."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-2 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            Refresh
          </button>
        </div>
      )}
      {!state.ok && state.error && (
        <div className="w-full rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}
    </form>
  );
}
