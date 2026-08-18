"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createQuestion, updateQuestion, type ActionState } from "./actions";
import type { QuizQuestionType } from "@/types/crm";

const QUESTION_MAX = 2000;
const OPTION_MAX = 200;
const MAX_OPTIONS = 8;

export function QuestionForm({
  quizId,
  questionId,
  initialQuestion,
}: {
  quizId: string;
  questionId?: string;
  initialQuestion?: {
    question_type: QuizQuestionType;
    question: string;
    options: string[];
    correct_answer: number[];
    points: number;
  };
}) {
  const router = useRouter();
  const isEdit = Boolean(questionId);
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    isEdit ? updateQuestion : createQuestion,
    { ok: false, error: null }
  );

  const [questionType, setQuestionType] = useState<QuizQuestionType>(
    initialQuestion?.question_type ?? "multiple_choice"
  );
  const [options, setOptions] = useState<string[]>(
    initialQuestion?.options ?? ["", ""]
  );
  const [correctIndex, setCorrectIndex] = useState<number>(
    initialQuestion?.correct_answer?.[0] ?? 0
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
        {isEdit ? "Edit" : "Add question"}
      </button>
    );
  }

  const isTrueFalse = questionType === "true_false";
  const submitOptions = isTrueFalse
    ? ["True", "False"]
    : options.map((option) => option.trim());
  const submitCorrect = [correctIndex];

  const addOption = () => {
    if (options.length < MAX_OPTIONS) {
      setOptions([...options, ""]);
    }
  };

  const updateOption = (index: number, value: string) => {
    setOptions(options.map((option, i) => (i === index ? value : option)));
  };

  const removeOption = (index: number) => {
    const next = options.filter((_, i) => i !== index);
    setOptions(next);
    if (correctIndex >= next.length) {
      setCorrectIndex(0);
    } else if (correctIndex === index) {
      setCorrectIndex(0);
    }
  };

  const switchType = (type: QuizQuestionType) => {
    setQuestionType(type);
    if (type === "true_false" && correctIndex > 1) {
      setCorrectIndex(0);
    }
  };

  return (
    <form
      action={formAction}
      className="mt-2 space-y-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50 p-4"
    >
      <input
        type="hidden"
        name={isEdit ? "questionId" : "quizId"}
        value={isEdit ? questionId ?? "" : quizId}
      />
      <input type="hidden" name="options" value={JSON.stringify(submitOptions)} />
      <input
        type="hidden"
        name="correct_answer"
        value={JSON.stringify(submitCorrect)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="number"
          name="points"
          min={0}
          max={1000}
          step={1}
          required
          defaultValue={initialQuestion?.points ?? 1}
          className="w-24 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
          aria-label="Points"
        />
        <select
          name="question_type"
          value={questionType}
          onChange={(event) => switchType(event.target.value as QuizQuestionType)}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
        >
          <option value="multiple_choice">Multiple choice</option>
          <option value="true_false">True / false</option>
        </select>
      </div>
      <textarea
        name="question"
        required
        maxLength={QUESTION_MAX}
        defaultValue={initialQuestion?.question ?? ""}
        placeholder="Enter the question text"
        rows={2}
        className="w-full rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
      />
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-[var(--color-text-secondary)]">
          {isTrueFalse ? "Answer" : "Options (mark the correct one)"}
        </legend>
        {submitOptions.map((option, index) => (
          <div
            key={index}
            className="flex items-center gap-2"
          >
            <input
              type="radio"
              name="correct"
              required
              checked={correctIndex === index}
              onChange={() => setCorrectIndex(index)}
              className="h-4 w-4 shrink-0 rounded-full border-[var(--color-border)] text-[var(--color-text-primary)] focus:ring-[var(--color-primary)]"
              aria-label={`Correct option ${index + 1}`}
            />
            {isTrueFalse ? (
              <span className="text-sm text-[var(--color-text-primary)]">{option}</span>
            ) : (
              <>
                <input
                  type="text"
                  value={option}
                  maxLength={OPTION_MAX}
                  onChange={(event) => updateOption(index, event.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                />
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  disabled={submitOptions.length <= 2}
                  className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-highest)] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Remove option"
                >
                  Remove
                </button>
              </>
            )}
          </div>
        ))}
        {!isTrueFalse && (
          <button
            type="button"
            onClick={addOption}
            disabled={options.length >= MAX_OPTIONS}
            className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-highest)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add option
          </button>
        )}
      </fieldset>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create question"}
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
      {state.ok && (
        <p className="text-xs text-[var(--color-success)]">
          {isEdit ? "Saved." : "Question created."}
        </p>
      )}
    </form>
  );
}
