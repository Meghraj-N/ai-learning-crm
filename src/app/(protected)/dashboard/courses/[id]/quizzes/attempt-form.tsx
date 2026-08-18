"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { submitAttempt, type RedirectActionState } from "./actions";
import type { AnswerableQuestion } from "@/lib/quizzes";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function AttemptForm({
  attemptId,
  questions,
}: {
  attemptId: string;
  questions: AnswerableQuestion[];
}) {
  const router = useRouter();
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [state, formAction, pending] = useActionState<
    RedirectActionState,
    FormData
  >(submitAttempt, { ok: false, error: null });

  useEffect(() => {
    if (state.ok && state.redirect) {
      router.push(state.redirect);
    }
  }, [state, router]);

  const answers = questions.map((question) => ({
    question_id: question.question_id,
    selected:
      selections[question.question_id] !== undefined
        ? [selections[question.question_id]]
        : [],
  }));

  const answeredCount = Object.keys(selections).length;
  const allAnswered = answeredCount === questions.length;

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <input type="hidden" name="attemptId" value={attemptId} />
      <input type="hidden" name="answers" value={JSON.stringify(answers)} />
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Answered {answeredCount} of {questions.length} questions.
        </p>
        <button
          type="submit"
          disabled={pending || !allAnswered}
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary)]/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Submit attempt"}
        </button>
      </div>
      {!allAnswered && (
        <p className="text-xs text-[var(--color-text-secondary)]">
          Answer every question before submitting.
        </p>
      )}
      <ol className="space-y-4">
        {questions.map((question, index) => (
          <li
            key={question.question_id}
            className="rounded-md border border-[var(--color-border)] p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {index + 1}. {question.question}
              </p>
              <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                {question.points} {question.points === 1 ? "point" : "points"}
              </span>
            </div>
            <div className="mt-3 space-y-1.5">
              {question.options.map((option, optionIndex) => {
                const fieldName = `q-${question.question_id}`;
                return (
                  <label
                    key={optionIndex}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${
                      selections[question.question_id] === optionIndex
                        ? "border-[var(--color-primary)] bg-[var(--color-surface-elevated)]/50 text-[var(--color-text-primary)]"
                        : "border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={fieldName}
                      value={optionIndex}
                      checked={selections[question.question_id] === optionIndex}
                      onChange={() =>
                        setSelections((current) => ({
                          ...current,
                          [question.question_id]: optionIndex,
                        }))
                      }
                      className="h-4 w-4 rounded-full border-[var(--color-border)] text-[var(--color-text-primary)] focus:ring-[var(--color-primary)]"
                    />
                    <span className="font-medium text-[var(--color-text-secondary)]">
                      {LETTERS[optionIndex] ?? optionIndex + 1}.
                    </span>
                    <span className="text-[var(--color-text-primary)]">{option}</span>
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      {state.error && (
        <p className="text-sm text-[var(--color-destructive)]">{state.error}</p>
      )}
    </form>
  );
}
