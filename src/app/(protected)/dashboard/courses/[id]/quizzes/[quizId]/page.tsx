import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import {
  canManageCourses,
  requireStudentContext,
} from "@/lib/crm";
import { getQuizQuestions, type QuizQuestionNode } from "@/lib/quizzes";
import {
  computeQuizQuestionPerformance,
  summarizeAttempts,
  type QuizAttemptSummary,
  type QuizQuestionPerformance,
} from "@/lib/analytics";
import {
  deriveQuizReadiness,
  quizReadinessBadgeClasses,
  type QuizReadiness,
  type QuizReadinessState,
} from "@/lib/readiness";
import type { QuizQuestionType } from "@/types/crm";
import AccessDenied from "../../../../access-denied";
import { QuizForm } from "../quiz-form";
import { QuestionForm } from "../question-form";
import { StartAttemptButton } from "../start-attempt-button";
import { OrderControls } from "../../../order-controls";
import {
  AnalyticsSection,
  EmptyState,
  MetricCard,
  MetricGrid,
  ProgressBar,
} from "../../../../analytics/ui";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

type QuizDetailRow = {
  quiz_id: string;
  course_id: string;
  title: string;
  description: string | null;
  pass_threshold: number;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  quiz_questions: { count: number }[] | null;
  quiz_attempts: { count: number }[] | null;
};

type StaffAttemptRow = {
  attempt_id: string;
  student_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  students: { first_name: string; last_name: string } | null;
};

type OwnAttemptRow = {
  attempt_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
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

export default async function QuizDetailPage({
  params,
}: {
  params: Promise<{ id: string; quizId: string }>;
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
  const canWrite = canManageCourses(role);
  const { id, quizId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: quiz, error } = await supabase
    .from("quizzes")
    .select(
      "quiz_id, course_id, title, description, pass_threshold, is_published, created_by, created_at, updated_at, quiz_questions(count), quiz_attempts(count)"
    )
    .eq("quiz_id", quizId)
    .maybeSingle<QuizDetailRow>();

  if (error || !quiz) {
    console.error("QuizDetail: quiz not found", quizId, error?.message);
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Quiz not found
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            The quiz you are looking for does not exist or is not available.
          </p>
          <Link
            href={`/dashboard/courses/${id}`}
            className="mt-6 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Back to course
          </Link>
        </div>
      </div>
    );
  }

  const { data: course } = await supabase
    .from("courses")
    .select("course_id, title")
    .eq("course_id", quiz.course_id)
    .maybeSingle<{ course_id: string; title: string }>();

  if (!course) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Course not found
          </h1>
          <Link
            href="/dashboard/courses"
            className="mt-6 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Back to courses
          </Link>
        </div>
      </div>
    );
  }

  const questionCount = quiz.quiz_questions?.[0]?.count ?? 0;
  const attemptCount = quiz.quiz_attempts?.[0]?.count ?? 0;

  let questions: QuizQuestionNode[] = [];
  let staffAttempts: StaffAttemptRow[] = [];
  let ownAttempts: OwnAttemptRow[] = [];
  let studentReadiness: QuizReadiness | null = null;
  let quizSummary: QuizAttemptSummary | null = null;
  let questionPerformance: QuizQuestionPerformance[] = [];
  let attemptsError: string | null = null;
  let readinessDistribution: Record<QuizReadinessState, number> | null = null;

  if (isStudent) {
    const studentCtx = await requireStudentContext();
    if (!studentCtx) {
      return <AccessDenied />;
    }
    const res = await supabase
      .from("quiz_attempts")
      .select("attempt_id, started_at, submitted_at, score, max_score")
      .eq("quiz_id", quizId)
      .eq("student_id", studentCtx.studentId)
      .order("started_at", { ascending: false })
      .returns<OwnAttemptRow[]>()
      .limit(100);
    if (res.error) {
      attemptsError = res.error.message;
    } else {
      ownAttempts = res.data ?? [];
    }
    studentReadiness = deriveQuizReadiness({
      quiz_id: quizId,
      title: quiz.title,
      pass_threshold: quiz.pass_threshold,
      attempts: ownAttempts,
    });
  } else {
    questions = await getQuizQuestions(supabase, quizId);
    const res = await supabase
      .from("quiz_attempts")
      .select(
        "attempt_id, student_id, started_at, submitted_at, score, max_score, students(first_name, last_name)"
      )
      .eq("quiz_id", quizId)
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .order("started_at", { ascending: false })
      .returns<StaffAttemptRow[]>();
    if (res.error) {
      attemptsError = res.error.message;
    } else {
      staffAttempts = res.data ?? [];
    }
    quizSummary = summarizeAttempts(staffAttempts, quiz.pass_threshold);
    const submittedIds = staffAttempts
      .filter((attempt) => attempt.submitted_at !== null)
      .map((attempt) => attempt.attempt_id);
    if (submittedIds.length > 0 && questions.length > 0) {
      const answersRes = await supabase
        .from("quiz_attempt_answers")
        .select("question_id, is_correct")
        .in("attempt_id", submittedIds)
        .returns<{ question_id: string; is_correct: boolean }[]>();
      if (answersRes.error) {
        console.error(
          "QuizDetail: answers query failed",
          answersRes.error.message
        );
      } else {
        questionPerformance = computeQuizQuestionPerformance(
          questions,
          answersRes.data ?? []
        );
      }
    }
    // Staff readiness distribution
    const [enrollmentsRes] = await Promise.all([
      supabase
        .from("enrollments")
        .select("student_id, status")
        .eq("course_id", quiz.course_id)
        .eq("status", "active")
        .returns<{ student_id: string; status: string }[]>(),
    ]);
    const enrolledStudentIds = (enrollmentsRes.data ?? []).map(
      (e) => e.student_id
    );
    const attemptsByStudent = new Map<string, StaffAttemptRow[]>();
    for (const attempt of staffAttempts) {
      const list = attemptsByStudent.get(attempt.student_id) ?? [];
      list.push(attempt);
      attemptsByStudent.set(attempt.student_id, list);
    }
    const dist: Record<QuizReadinessState, number> = {
      not_attempted: 0,
      in_progress: 0,
      passed: 0,
      failed: 0,
    };
    for (const studentId of enrolledStudentIds) {
      const attempts = attemptsByStudent.get(studentId) ?? [];
      const r = deriveQuizReadiness({
        quiz_id: quizId,
        title: quiz.title,
        pass_threshold: quiz.pass_threshold,
        attempts,
      });
      dist[r.state]++;
    }
    readinessDistribution = dist;
  }

  if (attemptsError) {
    console.error("QuizDetail: attempts query failed", attemptsError);
  }

  const publishedBadge = quiz.is_published ? (
    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
      published
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
      draft
    </span>
  );

  return (
    <div className="flex flex-1 justify-center px-4 py-8">
      <div className="w-full max-w-3xl">
        <nav className="text-sm text-zinc-500">
          <Link href="/dashboard/courses" className="hover:text-zinc-900">
            Courses
          </Link>
          <span className="mx-1">/</span>
          <Link
            href={`/dashboard/courses/${course.course_id}`}
            className="hover:text-zinc-900"
          >
            {course.title}
          </Link>
          <span className="mx-1">/</span>
          <span className="text-zinc-900">{quiz.title}</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              {quiz.title}
            </h1>
            {quiz.description ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600">
                {quiz.description}
              </p>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">No description.</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {publishedBadge}
            <span className="text-xs text-zinc-400">
              {questionCount} {questionCount === 1 ? "question" : "questions"}
            </span>
          </div>
        </div>

        <dl className="mt-6 divide-y divide-zinc-100 rounded-md border border-zinc-200">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-zinc-500">Pass threshold</dt>
            <dd className="text-sm font-medium text-zinc-900">
              {quiz.pass_threshold}%
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-zinc-500">Attempts</dt>
            <dd className="text-sm font-medium text-zinc-900">
              {attemptCount}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-zinc-500">Updated</dt>
            <dd className="text-sm font-medium text-zinc-900">
              {formatDateTime(quiz.updated_at)}
            </dd>
          </div>
        </dl>

        {canWrite && (
          <div className="mt-4 rounded-md border border-zinc-200 px-4 py-3">
            <QuizForm
              courseId={quiz.course_id}
              quizId={quiz.quiz_id}
              initialTitle={quiz.title}
              initialDescription={quiz.description ?? ""}
              initialThreshold={quiz.pass_threshold}
              initialPublished={quiz.is_published}
            />
          </div>
        )}

        {!isStudent && canWrite && (
          <div className="mt-4 rounded-md border border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Questions
            </h2>
            {questions.length > 0 ? (
              <ul className="mt-2 divide-y divide-zinc-100">
                {questions.map((question) => (
                  <li key={question.question_id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-zinc-900">
                          {question.position}. {question.question}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                          {question.question_type === "true_false"
                            ? "True / false"
                            : "Multiple choice"}
                        </span>
                        <span className="text-xs text-zinc-400">
                          {question.points}{" "}
                          {question.points === 1 ? "point" : "points"}
                        </span>
                      </div>
                      <OrderControls
                        kind="question"
                        itemId={question.question_id}
                        position={question.position}
                        total={questions.length}
                      />
                    </div>
                    <ul className="mt-2 space-y-1 pl-4">
                      {question.options.map((option, index) => (
                        <li
                          key={index}
                          className="text-sm text-zinc-600"
                        >
                          {LETTERS[index] ?? index + 1}. {option}
                          {question.correct_answer.includes(index) && (
                            <span className="ml-2 text-xs font-medium text-green-700">
                              (correct)
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 pl-4">
                      <QuestionForm
                        quizId={quiz.quiz_id}
                        questionId={question.question_id}
                        initialQuestion={{
                          question_type: question.question_type as QuizQuestionType,
                          question: question.question,
                          options: question.options,
                          correct_answer: question.correct_answer,
                          points: question.points,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">
                No questions yet. Add a question to build the quiz.
              </p>
            )}
            <div className="mt-2">
              <QuestionForm quizId={quiz.quiz_id} />
            </div>
          </div>
        )}

        {!isStudent && quizSummary && (
          <AnalyticsSection title="Quiz analytics">
            <MetricGrid>
              <MetricCard label="Total attempts" value={quizSummary.attempts} />
              <MetricCard
                label="Submitted attempts"
                value={quizSummary.submitted}
              />
              <MetricCard label="Passed" value={quizSummary.passed} />
              <MetricCard label="Failed" value={quizSummary.failed} />
              <MetricCard
                label="Pass rate"
                value={
                  quizSummary.passRate === null
                    ? "—"
                    : `${quizSummary.passRate}%`
                }
              />
              <MetricCard
                label="Average score"
                value={
                  quizSummary.averagePercent === null
                    ? "—"
                    : `${quizSummary.averagePercent}%`
                }
              />
              <MetricCard
                label="Highest score"
                value={
                  quizSummary.highestPercent === null
                    ? "—"
                    : `${quizSummary.highestPercent}%`
                }
              />
              <MetricCard
                label="Lowest score"
                value={
                  quizSummary.lowestPercent === null
                    ? "—"
                    : `${quizSummary.lowestPercent}%`
                }
              />
            </MetricGrid>
          </AnalyticsSection>
        )}

        {!isStudent && questions.length > 0 && (
          <AnalyticsSection
            title="Question performance"
            subtitle="Accuracy per question across all submitted attempts."
          >
            {questionPerformance.length === 0 ? (
              <EmptyState message="No submitted attempts yet, so per-question accuracy is not available." />
            ) : (
              <div className="overflow-x-auto rounded-md border border-zinc-200">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 font-medium text-zinc-500">
                        #
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-500">
                        Question
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-500">
                        Accuracy
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-500">
                        Correct
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-500">
                        Incorrect
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {questionPerformance.map((question) => (
                      <tr key={question.question_id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 text-zinc-400">
                          {question.position}
                        </td>
                        <td className="px-4 py-3 text-zinc-900">
                          {question.question}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24">
                              <ProgressBar percent={question.accuracyPercent ?? 0} />
                            </div>
                            <span className="text-xs font-medium text-zinc-900">
                              {question.accuracyPercent === null
                                ? "—"
                                : `${question.accuracyPercent}%`}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {question.correct}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {question.incorrect}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AnalyticsSection>
        )}

        {!isStudent && readinessDistribution && (
          <AnalyticsSection
            title="Readiness distribution"
            subtitle="Per-student readiness state across active enrollments."
          >
            <MetricGrid>
              <MetricCard label="Not attempted" value={readinessDistribution.not_attempted} />
              <MetricCard label="In progress" value={readinessDistribution.in_progress} />
              <MetricCard label="Passed" value={readinessDistribution.passed} />
              <MetricCard label="Failed" value={readinessDistribution.failed} />
            </MetricGrid>
            <p className="mt-2 text-xs text-zinc-500">
              Based on {Object.values(readinessDistribution).reduce((a, b) => a + b, 0)} active{" "}
              enrollment{Object.values(readinessDistribution).reduce((a, b) => a + b, 0) !== 1 ? "s" : ""}.
            </p>
          </AnalyticsSection>
        )}

        {isStudent && studentReadiness && (
          <div className="mt-4 rounded-md border border-zinc-200 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-zinc-900">
                Your readiness
              </h2>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${quizReadinessBadgeClasses(studentReadiness.state)}`}
              >
                {studentReadiness.state.replace("_", " ")}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-zinc-500">
              <span>
                {studentReadiness.attemptCount} attempt
                {studentReadiness.attemptCount !== 1 ? "s" : ""}
              </span>
              <span>
                {studentReadiness.submittedCount} submitted
              </span>
              {studentReadiness.bestPercent !== null && (
                <span>Best: {studentReadiness.bestPercent}%</span>
              )}
              {studentReadiness.lastPercent !== null && (
                <span>Last: {studentReadiness.lastPercent}%</span>
              )}
            </div>
            {studentReadiness.state === "passed" && (
              <p className="mt-2 text-sm font-medium text-green-700">
                ✓ Assessment passed
              </p>
            )}
            {studentReadiness.state === "failed" && (
              <p className="mt-2 text-sm text-red-700">
                Last attempt did not pass. You can retry — there is no attempt limit.
              </p>
            )}
            {studentReadiness.state === "in_progress" && (
              <p className="mt-2 text-sm text-zinc-700">
                You have an attempt in progress. Resume to continue.
              </p>
            )}
            {studentReadiness.state === "not_attempted" && (
              <p className="mt-2 text-sm text-zinc-500">
                Not attempted yet. Available to enrolled learners.
              </p>
            )}
          </div>
        )}

        {isStudent ? (
          <div className="mt-4 rounded-md border border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Your attempts
            </h2>
            {ownAttempts.length > 0 ? (
              <ul className="mt-2 divide-y divide-zinc-100">
                {ownAttempts.map((attempt) => {
                  const pct = percent(attempt.score, attempt.max_score);
                  const passed =
                    attempt.submitted_at !== null &&
                    pct !== null &&
                    pct >= quiz.pass_threshold;
                  return (
                    <li
                      key={attempt.attempt_id}
                      className="flex flex-wrap items-center justify-between gap-3 py-2"
                    >
                      <div className="text-sm text-zinc-700">
                        {attempt.submitted_at !== null ? (
                          <>
                            Submitted {formatDateTime(attempt.submitted_at)}
                          </>
                        ) : (
                          <span className="text-zinc-500">
                            Started {formatDateTime(attempt.started_at)} — in
                            progress
                          </span>
                        )}
                      </div>
                      {attempt.submitted_at !== null ? (
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-zinc-900">
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
                          <Link
                            href={`/dashboard/courses/${quiz.course_id}/quizzes/${quiz.quiz_id}/attempts/${attempt.attempt_id}`}
                            className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                          >
                            Review
                          </Link>
                        </div>
                      ) : (
                        <StartAttemptButton quizId={quiz.quiz_id} label="Resume" />
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">
                You have not attempted this quiz yet.
              </p>
            )}
            <div className="mt-3">
              <StartAttemptButton quizId={quiz.quiz_id} />
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              All attempts
            </h2>
            {staffAttempts.length > 0 ? (
              <ul className="mt-2 divide-y divide-zinc-100">
                {staffAttempts.map((attempt) => {
                  const pct = percent(attempt.score, attempt.max_score);
                  const passed =
                    attempt.submitted_at !== null &&
                    pct !== null &&
                    pct >= quiz.pass_threshold;
                  return (
                    <li
                      key={attempt.attempt_id}
                      className="flex flex-wrap items-center justify-between gap-3 py-2"
                    >
                      <div className="text-sm">
                        <span className="font-medium text-zinc-900">
                          {attempt.students?.first_name}{" "}
                          {attempt.students?.last_name}
                        </span>
                        {attempt.submitted_at !== null ? (
                          <p className="text-xs text-zinc-400">
                            Submitted {formatDateTime(attempt.submitted_at)}
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-400">In progress</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {attempt.submitted_at !== null ? (
                          <>
                            <span className="text-sm font-medium text-zinc-900">
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
                            <Link
                              href={`/dashboard/courses/${quiz.course_id}/quizzes/${quiz.quiz_id}/attempts/${attempt.attempt_id}`}
                              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                            >
                              Review
                            </Link>
                          </>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">
                No attempts recorded yet.
              </p>
            )}
          </div>
        )}

        <Link
          href={`/dashboard/courses/${quiz.course_id}`}
          className="mt-6 inline-block rounded-md px-3 py-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
        >
          Back to {course.title}
        </Link>
      </div>
    </div>
  );
}
