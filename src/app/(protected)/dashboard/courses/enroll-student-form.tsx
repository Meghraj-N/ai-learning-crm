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
          className="block text-sm font-medium text-[var(--color-text-primary)]"
        >
          Student
        </label>
        <select
          id="studentId"
          name="studentId"
          required
          className="mt-1 block w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
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
        className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
      >
        {pending ? "Enrolling…" : "Enroll student"}
      </button>

      {state.ok && state.error === null && (
        <div className="w-full">
          <div
            className={`rounded-md border px-4 py-3 ${
              state.alreadyEnrolled
                ? "border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10"
                : "border-[var(--color-success)]/20 bg-[var(--color-success)]/10"
            }`}
          >
            <p
              className={`text-sm ${
                state.alreadyEnrolled ? "text-[var(--color-warning)]" : "text-[var(--color-success)]"
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
            className="mt-2 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-highest)]"
          >
            Refresh
          </button>
        </div>
      )}
      {!state.ok && state.error && (
        <div className="w-full rounded-md border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3">
          <p className="text-sm text-[var(--color-destructive)]">{state.error}</p>
        </div>
      )}
    </form>
  );
}
