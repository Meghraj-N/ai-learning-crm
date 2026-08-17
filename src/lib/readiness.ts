import type { CourseModuleNode } from "@/lib/courses";
import type { LessonProgressStatus } from "@/types/crm";
import { quizPercentage } from "@/lib/analytics";

// ----------------------------------------------------------------------------
// Learner readiness — deterministic states derived from existing records only.
//
// IMPORTANT (architecture note): the schema has NO lesson <-> quiz
// relationship. `lessons` has no `quiz_id`, `quizzes` has no `lesson_id`, and
// quizzes are course-scoped (`quizzes.course_id`). Nothing in this module
// pretends a quiz belongs to a lesson or that a quiz is gated behind lesson
// completion. "Assessment available" is a *recommended ordering* state (Phase
// 13 priority: lessons -> quiz -> completed), not an enforced gate — learners
// may still start a published course quiz at any time under the current
// architecture. Retry is unlimited because the schema has no max-attempts
// field; this module never invents an attempt limit.
// ----------------------------------------------------------------------------

export type QuizAttemptView = {
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
};

export type ReadinessQuiz = {
  quiz_id: string;
  title: string;
  pass_threshold: number;
  attempts: QuizAttemptView[];
};

export type QuizReadinessState =
  | "not_attempted"
  | "in_progress"
  | "passed"
  | "failed";

export type QuizReadiness = {
  quiz_id: string;
  title: string;
  pass_threshold: number;
  state: QuizReadinessState;
  attemptCount: number;
  submittedCount: number;
  passedCount: number;
  bestPercent: number | null;
  lastPercent: number | null;
};

export function deriveQuizReadiness(quiz: ReadinessQuiz): QuizReadiness {
  const submitted = quiz.attempts
    .filter(
      (attempt) =>
        attempt.submitted_at !== null &&
        attempt.score !== null &&
        attempt.max_score !== null
    )
    .sort((a, b) => (a.submitted_at! < b.submitted_at! ? -1 : 1));

  const percents = submitted.map(
    (attempt) => quizPercentage(attempt.score, attempt.max_score) as number
  );
  const passedCount = submitted.filter(
    (attempt) =>
      (quizPercentage(attempt.score, attempt.max_score) as number) >=
      quiz.pass_threshold
  ).length;

  let state: QuizReadinessState;
  if (submitted.length === 0) {
    state = quiz.attempts.length > 0 ? "in_progress" : "not_attempted";
  } else {
    state = passedCount > 0 ? "passed" : "failed";
  }

  return {
    quiz_id: quiz.quiz_id,
    title: quiz.title,
    pass_threshold: quiz.pass_threshold,
    state,
    attemptCount: quiz.attempts.length,
    submittedCount: submitted.length,
    passedCount,
    bestPercent: percents.length > 0 ? Math.max(...percents) : null,
    lastPercent: percents.length > 0 ? percents[percents.length - 1] : null,
  };
}

export type CourseReadinessState =
  | "not_started"
  | "in_progress"
  | "assessment_available"
  | "needs_review"
  | "passed"
  | "completed";

export type RecommendedAction =
  | {
      kind: "lesson";
      lessonId: string;
      lessonTitle: string;
      moduleTitle: string;
      status: "not_started" | "in_progress";
    }
  | { kind: "quiz"; quizId: string; quizTitle: string }
  | { kind: "review"; quizId: string; quizTitle: string; lastPercent: number | null }
  | { kind: "completed" };

export type CourseReadiness = {
  state: CourseReadinessState;
  label: string;
  lessonsCompleted: number;
  totalPublishedLessons: number;
  lessonsRemaining: number;
  lessonsPercent: number;
  isLessonsComplete: boolean;
  quizzes: QuizReadiness[];
  passedQuizzes: number;
  failedQuizzes: number;
  availableQuizzes: number;
  recommendedAction: RecommendedAction | null;
  message: string;
};

export function deriveCourseReadiness(
  content: CourseModuleNode[],
  progressMap: Map<string, LessonProgressStatus>,
  quizzes: ReadinessQuiz[]
): CourseReadiness {
  const flat = content.flatMap((module) =>
    module.lessons
      .filter((lesson) => lesson.is_published)
      .map((lesson) => ({
        lessonId: lesson.lesson_id,
        lessonTitle: lesson.title,
        moduleTitle: module.title,
      }))
  );

  const completed = flat.filter(
    (lesson) => progressMap.get(lesson.lessonId) === "completed"
  ).length;
  const total = flat.length;
  const remaining = Math.max(0, total - completed);
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isLessonsComplete = total > 0 && completed >= total;

  const quizStates = quizzes.map(deriveQuizReadiness);
  const passedQuizzes = quizStates.filter(
    (quiz) => quiz.state === "passed"
  ).length;
  const failedQuizzes = quizStates.filter(
    (quiz) => quiz.state === "failed"
  ).length;
  const availableQuizzes = quizStates.filter(
    (quiz) => quiz.state !== "passed"
  ).length;

  const firstIncomplete = flat.find(
    (lesson) => progressMap.get(lesson.lessonId) !== "completed"
  );

  let state: CourseReadinessState;
  let label: string;
  let recommendedAction: RecommendedAction | null;
  let message: string;

  if (total === 0) {
    state = "not_started";
    label = "Not started";
    recommendedAction = null;
    message = "No published lessons available yet.";
  } else if (!isLessonsComplete) {
    const started =
      completed > 0 ||
      [...progressMap.values()].some((status) => status === "in_progress") ||
      quizStates.some((quiz) => quiz.attemptCount > 0);
    state = started ? "in_progress" : "not_started";
    label = started ? "In progress" : "Not started";
    recommendedAction = firstIncomplete
      ? {
          kind: "lesson",
          lessonId: firstIncomplete.lessonId,
          lessonTitle: firstIncomplete.lessonTitle,
          moduleTitle: firstIncomplete.moduleTitle,
          status:
            progressMap.get(firstIncomplete.lessonId) === "in_progress"
              ? "in_progress"
              : "not_started",
        }
      : null;
    message = `${completed} of ${total} lessons completed. ${remaining} remaining.`;
  } else if (quizzes.length === 0) {
    state = "completed";
    label = "Completed";
    recommendedAction = { kind: "completed" };
    message = "All lessons completed.";
  } else if (availableQuizzes === 0) {
    state = "passed";
    label = "Passed";
    recommendedAction = { kind: "completed" };
    message = "All required lessons and assessments completed.";
  } else {
    const failed = quizStates.find((quiz) => quiz.state === "failed");
    if (failed) {
      state = "needs_review";
      label = "Needs review";
      recommendedAction = {
        kind: "review",
        quizId: failed.quiz_id,
        quizTitle: failed.title,
        lastPercent: failed.lastPercent,
      };
      message = `Assessment "${failed.title}" was not passed${
        failed.lastPercent !== null ? ` (${failed.lastPercent}%)` : ""
      }. Review and retry.`;
    } else {
      const pending =
        quizStates.find((quiz) => quiz.state === "not_attempted") ??
        quizStates.find((quiz) => quiz.state === "in_progress");
      state = "assessment_available";
      label = "Assessment available";
      recommendedAction = pending
        ? { kind: "quiz", quizId: pending.quiz_id, quizTitle: pending.title }
        : null;
      message = "All required lessons are complete. Assessment available.";
    }
  }

  return {
    state,
    label,
    lessonsCompleted: completed,
    totalPublishedLessons: total,
    lessonsRemaining: remaining,
    lessonsPercent: percent,
    isLessonsComplete,
    quizzes: quizStates,
    passedQuizzes,
    failedQuizzes,
    availableQuizzes,
    recommendedAction,
    message,
  };
}

export function pickPrimaryReadiness(
  rows: CourseReadiness[]
): CourseReadiness | null {
  return (
    rows.find(
      (row) =>
        row.recommendedAction !== null &&
        row.recommendedAction.kind !== "completed"
    ) ?? null
  );
}

export type ReadinessInsights = {
  notStarted: number;
  inProgress: number;
  assessmentsAvailable: number;
  needsReview: number;
  passed: number;
  completed: number;
};

export function summarizeReadiness(
  rows: CourseReadiness[]
): ReadinessInsights {
  return {
    notStarted: rows.filter((row) => row.state === "not_started").length,
    inProgress: rows.filter((row) => row.state === "in_progress").length,
    assessmentsAvailable: rows.filter(
      (row) => row.state === "assessment_available"
    ).length,
    needsReview: rows.filter((row) => row.state === "needs_review").length,
    passed: rows.filter((row) => row.state === "passed").length,
    completed: rows.filter((row) => row.state === "completed").length,
  };
}

export function readinessBadgeClasses(state: CourseReadinessState): string {
  switch (state) {
    case "not_started":
      return "bg-zinc-100 text-zinc-500";
    case "in_progress":
      return "bg-zinc-200 text-zinc-700";
    case "assessment_available":
      return "bg-amber-100 text-amber-700";
    case "needs_review":
      return "bg-red-100 text-red-700";
    case "passed":
      return "bg-green-100 text-green-700";
    case "completed":
      return "bg-blue-100 text-blue-700";
  }
}

export function quizReadinessBadgeClasses(state: QuizReadinessState): string {
  switch (state) {
    case "not_attempted":
      return "bg-zinc-100 text-zinc-500";
    case "in_progress":
      return "bg-zinc-200 text-zinc-700";
    case "passed":
      return "bg-green-100 text-green-700";
    case "failed":
      return "bg-red-100 text-red-700";
  }
}

export function recommendedActionHref(
  courseId: string,
  action: RecommendedAction | null
): string | null {
  if (!action) {
    return null;
  }
  switch (action.kind) {
    case "lesson":
      return `/dashboard/courses/${courseId}/lessons/${action.lessonId}`;
    case "quiz":
    case "review":
      return `/dashboard/courses/${courseId}/quizzes/${action.quizId}`;
    case "completed":
      return null;
  }
}

export function recommendedActionLabel(
  action: RecommendedAction | null
): string | null {
  if (!action) {
    return null;
  }
  switch (action.kind) {
    case "lesson":
      return action.status === "in_progress"
        ? `Continue: ${action.moduleTitle} → ${action.lessonTitle}`
        : `Start: ${action.moduleTitle} → ${action.lessonTitle}`;
    case "quiz":
      return `Take quiz: ${action.quizTitle}`;
    case "review":
      return `Review: ${action.quizTitle}`;
    case "completed":
      return null;
  }
}