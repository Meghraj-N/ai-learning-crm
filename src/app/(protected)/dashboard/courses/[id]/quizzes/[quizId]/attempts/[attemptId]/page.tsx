import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { requireStudentContext } from "@/lib/crm";
import { getQuizQuestions } from "@/lib/quizzes";
import AccessDenied from "../../../../../../access-denied";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

type AttemptRow = {
  attempt_id: string;
  quiz_id: string;
  student_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  students?: { first_name: string; last_name: string } | null;
};

type AnswerRow = {
  question_id: string;
  selected_answer: number[];
  is_correct: boolean;
  points_earned: number;
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function percent(score: number | null, maxScore: number | null): number | null {
  if (score === null || maxScore === null || maxScore === 0) {
    return null;
  }
  return Math.round((score / maxScore) * 100);
}

function NotFoundCard({
  courseId,
  quizId,
}: {
  courseId: string;
  quizId: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Attempt not found
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          The attempt you are looking for does not exist or is not available.
        </p>
        <Link
          href={`/dashboard/courses/${courseId}/quizzes/${quizId}`}
          className="mt-6 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          Back to quiz
        </Link>
      </div>
    </div>
  );
}

export default async function AttemptReviewPage({
  params,
}: {
  params: Promise<{ id: string; quizId: string; attemptId: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active || !profile.organization_id) {
    return <AccessDenied />;
  }

  const role = profile.role;
  if (role === null) {
    return <AccessDenied />;
  }

  const isStudent = role === "student";
  const { id, quizId, attemptId } = await params;

  let studentId: string | null = null;
  if (isStudent) {
    const studentCtx = await requireStudentContext();
    if (!studentCtx) {
      return <AccessDenied />;
    }
    studentId = studentCtx.studentId;
  }

  const supabase = await createSupabaseServerClient();

  let attemptQuery = supabase
    .from("quiz_attempts")
    .select(
      "attempt_id, quiz_id, student_id, started_at, submitted_at, score, max_score, students(first_name, last_name)"
    )
    .eq("attempt_id", attemptId);
  if (studentId !== null) {
    attemptQuery = attemptQuery.eq("student_id", studentId);
  }
  const { data: attempt } =
    await attemptQuery.maybeSingle<AttemptRow>();

  if (!attempt || attempt.quiz_id !== quizId) {
    return <NotFoundCard courseId={id} quizId={quizId} />;
  }

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("quiz_id, course_id, title, pass_threshold")
    .eq("quiz_id", quizId)
    .maybeSingle<{
      quiz_id: string;
      course_id: string;
      title: string;
      pass_threshold: number;
    }>();

  if (!quiz) {
    return <NotFoundCard courseId={id} quizId={quizId} />;
  }

  const { data: course } = await supabase
    .from("courses")
    .select("course_id, title")
    .eq("course_id", quiz.course_id)
    .maybeSingle<{ course_id: string; title: string }>();

  if (attempt.submitted_at === null || attempt.score === null) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Attempt not submitted
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            This attempt is still in progress and has no results yet.
          </p>
          <Link
            href={`/dashboard/courses/${quiz.course_id}/quizzes/${quiz.quiz_id}`}
            className="mt-6 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Back to quiz
          </Link>
        </div>
      </div>
    );
  }

  const [questions, answersRes] = await Promise.all([
    getQuizQuestions(supabase, quizId),
    supabase
      .from("quiz_attempt_answers")
      .select("question_id, selected_answer, is_correct, points_earned")
      .eq("attempt_id", attemptId)
      .returns<AnswerRow[]>(),
  ]);

  const answers = answersRes.data ?? [];
  const answersByQuestion = new Map(
    answers.map((answer) => [answer.question_id, answer])
  );

  const pct = percent(attempt.score, attempt.max_score);
  const passed =
    pct !== null && pct >= quiz.pass_threshold;

  return (
    <div className="flex flex-1 justify-center px-4 py-8">
      <div className="w-full max-w-3xl">
        <nav className="text-sm text-zinc-500">
          <Link href="/dashboard/courses" className="hover:text-zinc-900">
            Courses
          </Link>
          <span className="mx-1">/</span>
          <Link
            href={`/dashboard/courses/${quiz.course_id}`}
            className="hover:text-zinc-900"
          >
            {course?.title ?? "Course"}
          </Link>
          <span className="mx-1">/</span>
          <Link
            href={`/dashboard/courses/${quiz.course_id}/quizzes/${quiz.quiz_id}`}
            className="hover:text-zinc-900"
          >
            {quiz.title}
          </Link>
          <span className="mx-1">/</span>
          <span className="text-zinc-900">Review</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              {attempt.students
                ? `${attempt.students.first_name} ${attempt.students.last_name} — `
                : "Your "}
              result
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Submitted {formatDateTime(attempt.submitted_at)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-lg font-semibold text-zinc-900">
              {attempt.score} / {attempt.max_score}
              {pct !== null && ` (${pct}%)`}
            </span>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                passed
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {passed ? "passed" : "not passed"}
            </span>
          </div>
        </div>

        {questions.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            Question details are no longer available for this quiz.
          </p>
        ) : (
          <ol className="mt-4 space-y-4">
            {questions.map((question, index) => {
              const answer = answersByQuestion.get(question.question_id);
              const selected = answer?.selected_answer ?? [];
              const isCorrect = answer?.is_correct ?? false;
              return (
                <li
                  key={question.question_id}
                  className="rounded-md border border-zinc-200 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-medium text-zinc-900">
                      {index + 1}. {question.question}
                    </p>
                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          isCorrect
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {isCorrect ? "correct" : "incorrect"}
                      </span>
                      <p className="mt-1 text-xs text-zinc-400">
                        {answer?.points_earned ?? 0} / {question.points} pts
                      </p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {question.options.map((option, optionIndex) => {
                      const isCorrectOption =
                        question.correct_answer.includes(optionIndex);
                      const isSelected = selected.includes(optionIndex);
                      return (
                        <li
                          key={optionIndex}
                          className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                            isCorrectOption
                              ? "border-green-300 bg-green-50 text-green-900"
                              : isSelected
                                ? "border-red-300 bg-red-50 text-red-900"
                                : "border-zinc-200 text-zinc-700"
                          }`}
                        >
                          <span className="font-medium">
                            {LETTERS[optionIndex] ?? optionIndex + 1}.
                          </span>
                          <span className="text-zinc-800">{option}</span>
                          {isCorrectOption && (
                            <span className="ml-auto text-xs font-medium text-green-700">
                              correct answer
                            </span>
                          )}
                          {isSelected && !isCorrectOption && (
                            <span className="ml-auto text-xs font-medium text-red-700">
                              your answer
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
        )}

        <Link
          href={`/dashboard/courses/${quiz.course_id}/quizzes/${quiz.quiz_id}`}
          className="mt-6 inline-block rounded-md px-3 py-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
        >
          Back to {quiz.title}
        </Link>
      </div>
    </div>
  );
}