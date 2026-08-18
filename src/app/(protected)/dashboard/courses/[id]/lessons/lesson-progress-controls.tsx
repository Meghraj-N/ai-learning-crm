"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { startLesson, completeLesson, type ActionState } from "./actions";
import type { LessonProgressStatus } from "@/types/crm";

export function LessonProgressControls({
  lessonId,
  enrollmentId,
  status,
  completedAt,
}: {
  lessonId: string;
  enrollmentId: string;
  status: LessonProgressStatus;
  completedAt: string | null;
}) {
  const router = useRouter();
  const [startState, startAction, startPending] = useActionState<
    ActionState,
    FormData
  >(startLesson, { ok: false, error: null });
  const [completeState, completeAction, completePending] = useActionState<
    ActionState,
    FormData
  >(completeLesson, { ok: false, error: null });

  useEffect(() => {
    if (startState.ok || completeState.ok) {
      router.refresh();
    }
  }, [startState, completeState, router]);

  if (status === "completed") {
    return (
      <div className="rounded-md border border-[var(--color-success)]/20 bg-[var(--color-success)]/10 px-4 py-3">
        <p className="text-sm font-medium text-[var(--color-success)]">✓ Completed</p>
        {completedAt && (
          <p className="mt-0.5 text-xs text-[var(--color-success)]">
            Completed{" "}
            {new Intl.DateTimeFormat("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(completedAt))}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "not_started" && (
        <form action={startAction} className="inline">
          <input type="hidden" name="lessonId" value={lessonId} />
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <button
            type="submit"
            disabled={startPending}
            className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
          >
            {startPending ? "Starting…" : "Start lesson"}
          </button>
        </form>
      )}
      <form action={completeAction} className="inline">
        <input type="hidden" name="lessonId" value={lessonId} />
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
        <button
          type="submit"
          disabled={completePending}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            status === "in_progress"
              ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90"
              : "border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-highest)]"
          }`}
        >
          {completePending ? "Saving…" : "Complete lesson"}
        </button>
      </form>
      {startState.error && (
        <p className="text-xs text-[var(--color-destructive)]">{startState.error}</p>
      )}
      {completeState.error && (
        <p className="text-xs text-[var(--color-destructive)]">{completeState.error}</p>
      )}
    </div>
  );
}