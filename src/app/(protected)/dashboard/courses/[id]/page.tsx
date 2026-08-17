import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import {
  canManageCourses,
  canManageEnrollments,
  requireStudentContext,
} from "@/lib/crm";
import {
  getLessonCountsByCourse,
  getPublishedLessonCountsByCourse,
  getCourseContent,
} from "@/lib/courses";
import {
  getLessonProgressMap,
  getLessonProgressRows,
  deriveProgress,
  deriveNextAction,
  type NextActionQuiz,
  type NextLearningAction,
} from "@/lib/progress";
import {
  computeCourseAnalytics,
  computeCourseEnrollmentAnalytics,
  computeLearningInsights,
  summarizeCourseQuizPerformance,
  type AnalyticsAttempt,
  type AnalyticsQuiz,
  type CourseEnrollmentAnalyticsRow,
  type CourseEnrollmentRow,
  type CompletionFilter,
} from "@/lib/analytics";
import {
  deriveCourseReadiness,
  quizReadinessBadgeClasses,
  readinessBadgeClasses,
  recommendedActionHref,
  recommendedActionLabel,
  summarizeReadiness,
  type CourseReadiness,
  type ReadinessInsights,
} from "@/lib/readiness";
import {
  AnalyticsSection,
  EmptyState,
  MetricCard,
  MetricGrid,
  ProgressBar,
} from "../../analytics/ui";
import type {
  Course,
  CourseStatus,
  EnrollmentStatus,
  LessonProgressStatus,
} from "@/types/crm";
import AccessDenied from "../../access-denied";
import { StatusBadge, enrollmentBadgeClasses } from "../status-badge";
import { EnrollStudentForm, type StudentOption } from "../enroll-student-form";
import { EnrollmentStatusControl } from "../enrollment-status-control";
import { ModuleForm } from "../module-form";
import { LessonForm } from "../lesson-form";
import { OrderControls } from "../order-controls";
import { PublishToggle } from "../publish-toggle";
import { QuizForm } from "./quizzes/quiz-form";

type StaffEnrollmentRow = {
  enrollment_id: string;
  student_id: string;
  status: EnrollmentStatus;
  ended_at: string | null;
  created_at: string;
  enrolled_by: string | null;
  students: {
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
};

type StudentEnrollmentRow = {
  enrollment_id: string;
  status: EnrollmentStatus;
  ended_at: string | null;
  created_at: string;
};

type CourseWithCounts = Course & {
  course_modules: { count: number }[] | null;
};

type CourseQuizRow = {
  quiz_id: string;
  course_id: string;
  title: string;
  pass_threshold: number;
  is_published: boolean;
  created_at: string;
  quiz_questions: { count: number }[] | null;
  quiz_attempts: { count: number }[] | null;
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="text-sm font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  const canWriteCourse = canManageCourses(role);
  const canWriteEnrollment = canManageEnrollments(role);

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: course, error } = await supabase
    .from("courses")
    .select(
      "course_id, organization_id, title, description, status, created_by, created_at, updated_at, course_modules(count)"
    )
    .eq("course_id", id)
    .maybeSingle<CourseWithCounts>();

  if (error || !course) {
    console.error("CourseDetail: course not found", id, error?.message);
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Course not found
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            The course you are looking for does not exist or is not available.
          </p>
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

  const courseIds = [course.course_id];
  const [lessonCounts, publishedLessonCounts, creatorRes, studentsRes, content, quizzesRes] =
    await Promise.all([
      getLessonCountsByCourse(supabase, courseIds),
      getPublishedLessonCountsByCourse(supabase, courseIds),
      course.created_by
        ? supabase
            .from("profiles")
            .select("user_id, full_name")
            .eq("user_id", course.created_by)
            .maybeSingle<{ user_id: string; full_name: string }>()
        : Promise.resolve({ data: null, error: null }),
      !isStudent && canWriteEnrollment
        ? supabase
            .from("students")
            .select("student_id, first_name, last_name, email")
            .is("deleted_at", null)
            .order("first_name")
            .order("last_name")
            .limit(500)
        : Promise.resolve({ data: [], error: null }),
      getCourseContent(supabase, course.course_id),
      supabase
        .from("quizzes")
        .select(
          "quiz_id, course_id, title, pass_threshold, is_published, created_at, quiz_questions(count), quiz_attempts(count)"
        )
        .eq("course_id", course.course_id)
        .order("created_at", { ascending: false })
        .returns<CourseQuizRow[]>(),
    ]);

  const lessonContents = new Map<string, string>();
  if (canWriteCourse) {
    const lessonIds = content.flatMap((module) =>
      module.lessons.map((lesson) => lesson.lesson_id)
    );
    if (lessonIds.length > 0) {
      const { data: lessonRows } = await supabase
        .from("lessons")
        .select("lesson_id, content")
        .in("lesson_id", lessonIds);
      for (const row of lessonRows ?? []) {
        lessonContents.set(row.lesson_id, row.content);
      }
    }
  }

  let ownEnrollment: StudentEnrollmentRow | null = null;
  let enrollments: StaffEnrollmentRow[] = [];
  let enrollmentsError: string | null = null;
  if (isStudent) {
    const res = await supabase
      .from("enrollments")
      .select("enrollment_id, status, ended_at, created_at")
      .eq("course_id", course.course_id)
      .returns<StudentEnrollmentRow[]>()
      .limit(1);
    if (res.error) {
      enrollmentsError = res.error.message;
    } else {
      ownEnrollment = (res.data ?? [])[0] ?? null;
    }
  } else {
    const res = await supabase
      .from("enrollments")
      .select(
        "enrollment_id, student_id, status, ended_at, created_at, enrolled_by, students(first_name, last_name, email)"
      )
      .eq("course_id", course.course_id)
      .order("created_at", { ascending: false })
      .returns<StaffEnrollmentRow[]>();
    if (res.error) {
      enrollmentsError = res.error.message;
    } else {
      enrollments = res.data ?? [];
    }
  }

  if (creatorRes.error) {
    console.error("CourseDetail: creator query failed", creatorRes.error.message);
  }
  if (studentsRes.error) {
    console.error("CourseDetail: students query failed", studentsRes.error.message);
  }
  if (enrollmentsError) {
    console.error("CourseDetail: enrollments query failed", enrollmentsError);
  }
  if (quizzesRes.error) {
    console.error("CourseDetail: quizzes query failed", quizzesRes.error.message);
  }

  const creator = creatorRes.data;
  const moduleCount = course.course_modules?.[0]?.count ?? 0;
  const lessonCount = lessonCounts.get(course.course_id) ?? 0;
  const publishedLessonCount = publishedLessonCounts.get(course.course_id) ?? 0;
  const quizzes = quizzesRes.data ?? [];

  let studentCtx: Awaited<ReturnType<typeof requireStudentContext>> = null;
  if (isStudent) {
    studentCtx = await requireStudentContext();
  }

  let studentProgress: {
    map: Map<string, LessonProgressStatus>;
    derived: {
      completed: number;
      total: number;
      percent: number;
      isComplete: boolean;
    };
    attemptsByQuiz: Map<
      string,
      {
        started_at: string;
        submitted_at: string | null;
        score: number | null;
        max_score: number | null;
      }[]
    >;
    nextAction: NextLearningAction | null;
  } | null = null;
  if (isStudent && ownEnrollment) {
    const map = await getLessonProgressMap(supabase, ownEnrollment.enrollment_id);
    const completedCount = [...map.values()].filter(
      (status) => status === "completed"
    ).length;

    const quizIds = quizzes.map((quiz) => quiz.quiz_id);
    const attemptsByQuiz = new Map<
      string,
      {
        started_at: string;
        submitted_at: string | null;
        score: number | null;
        max_score: number | null;
      }[]
    >();
    if (quizIds.length > 0 && studentCtx) {
      const { data: attempts } = await supabase
        .from("quiz_attempts")
        .select("quiz_id, started_at, submitted_at, score, max_score")
        .in("quiz_id", quizIds)
        .eq("student_id", studentCtx.studentId)
        .returns<
          {
            quiz_id: string;
            started_at: string;
            submitted_at: string | null;
            score: number | null;
            max_score: number | null;
          }[]
        >();
      for (const attempt of attempts ?? []) {
        const list = attemptsByQuiz.get(attempt.quiz_id) ?? [];
        list.push(attempt);
        attemptsByQuiz.set(attempt.quiz_id, list);
      }
    }

    const courseQuizzes: NextActionQuiz[] = quizzes.map((quiz) => ({
      quiz_id: quiz.quiz_id,
      title: quiz.title,
      pass_threshold: quiz.pass_threshold,
      attempts: attemptsByQuiz.get(quiz.quiz_id) ?? [],
    }));
    studentProgress = {
      map,
      derived: deriveProgress(completedCount, publishedLessonCount),
      attemptsByQuiz,
      nextAction: deriveNextAction(content, map, courseQuizzes),
    };
  }

  let studentReadiness: CourseReadiness | null = null;
  if (isStudent && studentProgress) {
    const publishedQuizzes = quizzes
      .filter((quiz) => quiz.is_published)
      .map((quiz) => ({
        quiz_id: quiz.quiz_id,
        title: quiz.title,
        pass_threshold: quiz.pass_threshold,
        attempts:
          studentProgress.attemptsByQuiz.get(quiz.quiz_id) ??
          ([] as { submitted_at: string | null; score: number | null; max_score: number | null }[]),
      }));
    studentReadiness = deriveCourseReadiness(
      content,
      studentProgress.map,
      publishedQuizzes
    );
  }

  let analyticsRows: CourseEnrollmentAnalyticsRow[] = [];
  let courseAnalytics: ReturnType<typeof computeCourseAnalytics> | null = null;
  let insights: ReturnType<typeof computeLearningInsights> | null = null;
  let analyticsByEnrollment = new Map<string, CourseEnrollmentAnalyticsRow>();
  let readinessByEnrollment = new Map<string, CourseReadiness>();
  let readinessSummary: ReadinessInsights | null = null;
  if (!isStudent && enrollments.length > 0) {
    const publishedQuizzes: AnalyticsQuiz[] = quizzes
      .filter((quiz) => quiz.is_published)
      .map((quiz) => ({
        quiz_id: quiz.quiz_id,
        course_id: quiz.course_id,
        title: quiz.title,
        pass_threshold: quiz.pass_threshold,
        is_published: quiz.is_published,
      }));
    const publishedQuizIds = publishedQuizzes.map((quiz) => quiz.quiz_id);
    const enrollmentIds = enrollments.map(
      (enrollment) => enrollment.enrollment_id
    );

    const [progressRows, attemptsRes] = await Promise.all([
      getLessonProgressRows(supabase, enrollmentIds),
      publishedQuizIds.length > 0
        ? supabase
            .from("quiz_attempts")
            .select(
              "attempt_id, quiz_id, student_id, started_at, submitted_at, score, max_score"
            )
            .in("quiz_id", publishedQuizIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const courseAttempts: AnalyticsAttempt[] = (attemptsRes.data ?? []) as AnalyticsAttempt[];

    const publishedLessonIds = new Set(
      content
        .flatMap((module) => module.lessons)
        .filter((lesson) => lesson.is_published)
        .map((lesson) => lesson.lesson_id)
    );
    const courseEnrollments: CourseEnrollmentRow[] = enrollments.map(
      (enrollment) => ({
        enrollment_id: enrollment.enrollment_id,
        student_id: enrollment.student_id,
        status: enrollment.status,
        created_at: enrollment.created_at,
        ended_at: enrollment.ended_at,
        students: enrollment.students,
      })
    );
    analyticsRows = computeCourseEnrollmentAnalytics(
      courseEnrollments,
      progressRows,
      publishedLessonIds,
      courseAttempts,
      publishedQuizzes
    );
    analyticsByEnrollment = new Map(
      analyticsRows.map((row) => [row.enrollment_id, row])
    );
    courseAnalytics = computeCourseAnalytics(
      analyticsRows,
      publishedLessonCount,
      publishedQuizzes.length,
      summarizeCourseQuizPerformance(courseAttempts, publishedQuizzes)
    );
    insights = computeLearningInsights(
      analyticsRows,
      progressRows,
      publishedLessonCount
    );

    const progressMapByEnrollment = new Map<
      string,
      Map<string, LessonProgressStatus>
    >();
    for (const row of progressRows) {
      let map = progressMapByEnrollment.get(row.enrollment_id);
      if (!map) {
        map = new Map();
        progressMapByEnrollment.set(row.enrollment_id, map);
      }
      map.set(row.lesson_id, row.status);
    }

    const readinessList: CourseReadiness[] = [];
    for (const enrollment of courseEnrollments) {
      const progressMap =
        progressMapByEnrollment.get(enrollment.enrollment_id) ??
        new Map<string, LessonProgressStatus>();
      const studentAttempts = courseAttempts.filter(
        (attempt) => attempt.student_id === enrollment.student_id
      );
      const quizzesForStudent = publishedQuizzes.map((quiz) => ({
        quiz_id: quiz.quiz_id,
        title: quiz.title,
        pass_threshold: quiz.pass_threshold,
        attempts: studentAttempts
          .filter((attempt) => attempt.quiz_id === quiz.quiz_id)
          .map((attempt) => ({
            submitted_at: attempt.submitted_at,
            score: attempt.score,
            max_score: attempt.max_score,
          })),
      }));
      readinessList.push(
        deriveCourseReadiness(content, progressMap, quizzesForStudent)
      );
    }
    readinessByEnrollment = new Map(
      analyticsRows.map((row, index) => [
        row.enrollment_id,
        readinessList[index],
      ])
    );
    readinessSummary = summarizeReadiness(readinessList);
  }

  const sp = await searchParams;
  const performanceSearch = (
    typeof sp.student === "string" ? sp.student : ""
  ).trim().slice(0, 100);
  const performanceStatus =
    typeof sp.estatus === "string" &&
    (["active", "paused", "completed", "cancelled"] as const).includes(
      sp.estatus as EnrollmentStatus
    )
      ? (sp.estatus as EnrollmentStatus)
      : null;
  const completionValue =
    typeof sp.completion === "string" ? sp.completion : null;
  const performanceCompletion: CompletionFilter | null =
    completionValue !== null &&
    ["not_started", "in_progress", "nearly_complete", "complete"].includes(
      completionValue
    )
      ? (completionValue as CompletionFilter)
      : null;
  const filteredPerformanceRows = analyticsRows.filter((row) => {
    if (
      performanceSearch &&
      !row.student_name.toLowerCase().includes(performanceSearch.toLowerCase())
    ) {
      return false;
    }
    if (performanceStatus && row.enrollment_status !== performanceStatus) {
      return false;
    }
    if (performanceCompletion !== null) {
      const matches =
        performanceCompletion === "not_started"
          ? row.completionPercent === 0
          : performanceCompletion === "in_progress"
            ? row.completionPercent >= 1 && row.completionPercent <= 49
            : performanceCompletion === "nearly_complete"
              ? row.completionPercent >= 50 && row.completionPercent <= 99
              : row.completionPercent === 100;
      if (!matches) {
        return false;
      }
    }
    return true;
  });

  const hasPerformanceFilters = Boolean(
    performanceSearch || performanceStatus || performanceCompletion
  );

  return (
    <div className="flex flex-1 justify-center px-4 py-8">
      <div className="w-full max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              {course.title}
            </h1>
            {course.description ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600">
                {course.description}
              </p>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">No description.</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={course.status as CourseStatus} />
            {canWriteCourse && (
              <Link
                href={`/dashboard/courses/${course.course_id}/edit`}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
              >
                Edit
              </Link>
            )}
          </div>
        </div>

        <dl className="mt-6 divide-y divide-zinc-100 rounded-md border border-zinc-200">
          <InfoRow
            label="Created"
            value={formatDateTime(course.created_at)}
          />
          <InfoRow
            label="Creator"
            value={creator?.full_name ?? "—"}
          />
          <InfoRow label="Modules" value={moduleCount} />
          <InfoRow label="Lessons" value={lessonCount} />
        </dl>

        {!isStudent && courseAnalytics && (
          <AnalyticsSection title="Course analytics">
            <MetricGrid>
              <MetricCard
                label="Total enrolled"
                value={courseAnalytics.totalEnrollments}
              />
              <MetricCard
                label="Active enrollments"
                value={courseAnalytics.activeEnrollments}
              />
              <MetricCard
                label="Completed enrollments"
                value={courseAnalytics.completedEnrollments}
              />
              <MetricCard
                label="Paused enrollments"
                value={courseAnalytics.pausedEnrollments}
              />
              <MetricCard
                label="Cancelled enrollments"
                value={courseAnalytics.cancelledEnrollments}
              />
              <MetricCard
                label="Average completion"
                value={
                  courseAnalytics.averageCompletionPercent === null
                    ? "—"
                    : `${courseAnalytics.averageCompletionPercent}%`
                }
                sub={
                  courseAnalytics.totalPublishedLessons === 0
                    ? "No published lessons"
                    : undefined
                }
              />
              <MetricCard
                label="Published lessons"
                value={courseAnalytics.totalPublishedLessons}
              />
              <MetricCard
                label="Published quizzes"
                value={courseAnalytics.totalPublishedQuizzes}
              />
              <MetricCard
                label="Quiz attempts"
                value={courseAnalytics.quizAttempts}
                sub={`${courseAnalytics.quizSubmitted} submitted`}
              />
              <MetricCard
                label="Quiz pass rate"
                value={
                  courseAnalytics.quizPassRate === null
                    ? "—"
                    : `${courseAnalytics.quizPassRate}%`
                }
                sub={`${courseAnalytics.quizzesPassed} passed`}
              />
              <MetricCard
                label="Average quiz score"
                value={
                  courseAnalytics.averageQuizScorePercent === null
                    ? "—"
                    : `${courseAnalytics.averageQuizScorePercent}%`
                }
              />
            </MetricGrid>
            {courseAnalytics.totalPublishedLessons === 0 ? (
              <div className="mt-3">
                <EmptyState message="No published lessons available yet, so no completion distribution can be shown." />
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-xs font-medium text-zinc-500">
                  Completion distribution across {courseAnalytics.totalEnrollments}{" "}
                  {courseAnalytics.totalEnrollments === 1 ? "enrollment" : "enrollments"}
                </p>
                <div className="mt-2 space-y-1.5">
                  {[
                    { label: "0%", value: courseAnalytics.studentsAt0 },
                    { label: "1–49%", value: courseAnalytics.students1To49 },
                    { label: "50–99%", value: courseAnalytics.students50To99 },
                    { label: "100%", value: courseAnalytics.studentsAt100 },
                  ].map((bucket) => (
                    <div
                      key={bucket.label}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="w-14 shrink-0 text-zinc-500">
                        {bucket.label}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-green-500"
                          style={{
                            width: `${courseAnalytics.totalEnrollments > 0 ? (bucket.value / courseAnalytics.totalEnrollments) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right font-medium text-zinc-900">
                        {bucket.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </AnalyticsSection>
        )}

        {!isStudent && insights && (
          <AnalyticsSection
            title="Learning insights"
            subtitle="Deterministic facts derived from progress and quiz records."
          >
            <ul className="space-y-1.5 text-sm">
              <li className="text-zinc-600">
                {insights.studentsAtZero}{" "}
                {insights.studentsAtZero === 1 ? "student is" : "students are"} at 0% progress.
              </li>
              <li className="text-zinc-600">
                {insights.studentsBelowHalf}{" "}
                {insights.studentsBelowHalf === 1 ? "student is" : "students are"} between 1% and 49% completion.
              </li>
              <li className="text-zinc-600">
                {insights.incompleteActiveEnrollments}{" "}
                {insights.incompleteActiveEnrollments === 1 ? "active enrollment is" : "active enrollments are"} incomplete.
              </li>
              <li className="text-zinc-600">
                {insights.lessonsInProgressEnrollments}{" "}
                {insights.lessonsInProgressEnrollments === 1 ? "enrollment has" : "enrollments have"} lessons started but not completed.
              </li>
              <li className="text-zinc-600">
                {insights.repeatedlyFailingStudents}{" "}
                {insights.repeatedlyFailingStudents === 1 ? "student has" : "students have"} submitted quizzes at least twice without a passing score.
              </li>
              <li className="text-zinc-600">
                {insights.lowQuizPerformanceStudents}{" "}
                {insights.lowQuizPerformanceStudents === 1 ? "student has" : "students have"} an average quiz score below 50%.
              </li>
            </ul>
          </AnalyticsSection>
        )}

        {!isStudent && readinessSummary && (
          <AnalyticsSection
            title="Readiness insights"
            subtitle="Deterministic readiness facts per enrolled student."
          >
            <ul className="space-y-1.5 text-sm">
              <li className="text-zinc-600">
                {readinessSummary.assessmentsAvailable}{" "}
                {readinessSummary.assessmentsAvailable === 1 ? "student is" : "students are"} ready for an available assessment.
              </li>
              <li className="text-zinc-600">
                {readinessSummary.needsReview}{" "}
                {readinessSummary.needsReview === 1 ? "student has" : "students have"} a failed assessment to review.
              </li>
              <li className="text-zinc-600">
                {readinessSummary.passed}{" "}
                {readinessSummary.passed === 1 ? "student has" : "students have"} passed all available assessments.
              </li>
              <li className="text-zinc-600">
                {readinessSummary.completed}{" "}
                {readinessSummary.completed === 1 ? "student has" : "students have"} completed the course.
              </li>
              <li className="text-zinc-600">
                {readinessSummary.notStarted}{" "}
                {readinessSummary.notStarted === 1 ? "student has" : "students have"} no learning activity yet.
              </li>
            </ul>
          </AnalyticsSection>
        )}

        {!isStudent && courseAnalytics && (
          <AnalyticsSection
            title="Student performance"
            subtitle="Per-enrollment learning progress and quiz performance."
          >
            <form method="get" className="flex flex-wrap items-end gap-3">
              <div className="flex-1 basis-48">
                <label htmlFor="student-q" className="sr-only">
                  Search student
                </label>
                <input
                  id="student-q"
                  name="student"
                  type="search"
                  defaultValue={performanceSearch}
                  placeholder="Search student…"
                  className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                />
              </div>
              <select
                name="estatus"
                defaultValue={performanceStatus ?? ""}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                name="completion"
                defaultValue={performanceCompletion ?? ""}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500"
              >
                <option value="">All completion</option>
                <option value="not_started">Not started</option>
                <option value="in_progress">In progress (1–49%)</option>
                <option value="nearly_complete">Nearly complete (50–99%)</option>
                <option value="complete">Complete (100%)</option>
              </select>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
              >
                Filter
              </button>
              {hasPerformanceFilters && (
                <Link
                  href={`/dashboard/courses/${course.course_id}`}
                  className="rounded-md px-3 py-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
                >
                  Clear
                </Link>
              )}
            </form>

            {analyticsRows.length === 0 ? (
              <div className="mt-3">
                <EmptyState message="No students enrolled yet." />
              </div>
            ) : courseAnalytics.totalPublishedLessons === 0 ? (
              <div className="mt-3">
                <EmptyState message="No published lessons available yet, so completion and quiz columns cannot be derived." />
              </div>
            ) : filteredPerformanceRows.length === 0 ? (
              <div className="mt-3">
                <EmptyState message="No students match the current filters." />
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-md border border-zinc-200">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 font-medium text-zinc-500">
                        Student
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-500">
                        Status
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-500">
                        Completion
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-500">
                        Lessons
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-500">
                        Quiz attempts
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-500">
                        Pass rate
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-500">
                        Avg score
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {filteredPerformanceRows.map((row) => (
                      <tr key={row.enrollment_id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/students/${row.student_id}`}
                            className="font-medium text-zinc-900 underline-offset-4 hover:underline"
                          >
                            {row.student_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${enrollmentBadgeClasses(row.enrollment_status)}`}
                          >
                            {row.enrollment_status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24">
                              <ProgressBar percent={row.completionPercent} />
                            </div>
                            <span className="text-xs font-medium text-zinc-900">
                              {row.completionPercent}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {row.completedLessons}/{row.totalPublishedLessons}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {row.quizAttempts}
                          {row.quizSubmitted > 0 && (
                            <span className="text-zinc-400">
                              {" "}
                              ({row.quizSubmitted} submitted)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {row.quizPassRate === null
                            ? "—"
                            : `${row.quizPassRate}%`}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {row.averageQuizScorePercent === null
                            ? "—"
                            : `${row.averageQuizScorePercent}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AnalyticsSection>
        )}

        {!isStudent && readinessSummary && (
          <AnalyticsSection
            title="Learning readiness"
            subtitle="Deterministic readiness state per enrolled student."
          >
            <MetricGrid>
              <MetricCard label="Not started" value={readinessSummary.notStarted} />
              <MetricCard label="In progress" value={readinessSummary.inProgress} />
              <MetricCard
                label="Assessment available"
                value={readinessSummary.assessmentsAvailable}
              />
              <MetricCard label="Needs review" value={readinessSummary.needsReview} />
              <MetricCard label="Passed" value={readinessSummary.passed} />
              <MetricCard label="Completed" value={readinessSummary.completed} />
            </MetricGrid>
            <div className="mt-3 overflow-x-auto rounded-md border border-zinc-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-zinc-500">
                      Student
                    </th>
                    <th className="px-4 py-3 font-medium text-zinc-500">
                      Readiness
                    </th>
                    <th className="px-4 py-3 font-medium text-zinc-500">
                      Lessons
                    </th>
                    <th className="px-4 py-3 font-medium text-zinc-500">
                      Recommended next action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {analyticsRows.map((row) => {
                    const readiness = readinessByEnrollment.get(
                      row.enrollment_id
                    );
                    if (!readiness) {
                      return null;
                    }
                    return (
                      <tr key={row.enrollment_id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/students/${row.student_id}`}
                            className="font-medium text-zinc-900 underline-offset-4 hover:underline"
                          >
                            {row.student_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${readinessBadgeClasses(readiness.state)}`}
                          >
                            {readiness.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {readiness.lessonsCompleted}/
                          {readiness.totalPublishedLessons}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {readiness.recommendedAction &&
                          readiness.recommendedAction.kind !== "completed" ? (
                            (() => {
                              const href = recommendedActionHref(
                                course.course_id,
                                readiness.recommendedAction
                              );
                              const label = recommendedActionLabel(
                                readiness.recommendedAction
                              );
                              return href && label ? (
                                <Link
                                  href={href}
                                  className="underline-offset-4 hover:text-zinc-900 hover:underline"
                                >
                                  {label}
                                </Link>
                              ) : null;
                            })()
                          ) : (
                            <span className="text-green-700">
                              ✓ All complete
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AnalyticsSection>
        )}

        {isStudent && studentProgress && (
          <div className="mt-4 rounded-md border border-zinc-200 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold text-zinc-900">
                Course progress
              </h2>
              <span className="text-sm font-medium text-zinc-900">
                {studentProgress.derived.percent}%
              </span>
            </div>
            {studentProgress.derived.total > 0 ? (
              <>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{
                      width: `${studentProgress.derived.percent}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  {studentProgress.derived.completed} of{" "}
                  {studentProgress.derived.total} lessons completed
                </p>
                {studentProgress.nextAction?.kind === "lesson" && (
                  <Link
                    href={`/dashboard/courses/${course.course_id}/lessons/${studentProgress.nextAction.lessonId}`}
                    className="mt-3 inline-block rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
                  >
                    {studentProgress.nextAction.status === "in_progress"
                      ? "Continue lesson →"
                      : "Start next lesson →"}
                  </Link>
                )}
                {studentProgress.nextAction?.kind === "quiz" && (
                  <Link
                    href={`/dashboard/courses/${course.course_id}/quizzes/${studentProgress.nextAction.quizId}`}
                    className="mt-3 inline-block rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
                  >
                    Take quiz → {studentProgress.nextAction.quizTitle}
                  </Link>
                )}
                {studentProgress.nextAction?.kind === "completed" && (
                  <p className="mt-1 text-sm font-medium text-green-700">
                    ✓ Course completed
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">
                No lessons available yet.
              </p>
            )}
          </div>
        )}

        {isStudent && studentReadiness && (
          <div className="mt-4 rounded-md border border-zinc-200 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-zinc-900">
                Learning readiness
              </h2>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${readinessBadgeClasses(studentReadiness.state)}`}
              >
                {studentReadiness.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-600">
              {studentReadiness.message}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-zinc-500">
              <span>
                {studentReadiness.lessonsCompleted} of{" "}
                {studentReadiness.totalPublishedLessons} lessons completed ·{" "}
                {studentReadiness.lessonsPercent}%
              </span>
              {studentReadiness.quizzes.length > 0 && (
                <span>
                  {studentReadiness.passedQuizzes} passed ·{" "}
                  {studentReadiness.failedQuizzes} failed ·{" "}
                  {studentReadiness.availableQuizzes} available
                </span>
              )}
            </div>
            {studentReadiness.quizzes.length > 0 && (
              <ul className="mt-2 space-y-1">
                {studentReadiness.quizzes.map((quiz) => (
                  <li
                    key={quiz.quiz_id}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-zinc-600">
                      {quiz.title}
                      {quiz.bestPercent !== null
                        ? ` · best ${quiz.bestPercent}%`
                        : ""}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 font-medium ${quizReadinessBadgeClasses(quiz.state)}`}
                    >
                      {quiz.state.replace("_", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {studentReadiness.recommendedAction &&
              studentReadiness.recommendedAction.kind !== "completed" &&
              (() => {
                const href = recommendedActionHref(
                  course.course_id,
                  studentReadiness.recommendedAction
                );
                const label = recommendedActionLabel(
                  studentReadiness.recommendedAction
                );
                return href && label ? (
                  <Link
                    href={href}
                    className="mt-3 inline-block rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
                  >
                    {label} →
                  </Link>
                ) : null;
              })()}
          </div>
        )}

        <div className="mt-4 rounded-md border border-zinc-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Course content
            </h2>
            {canWriteCourse && (
              <ModuleForm courseId={course.course_id} />
            )}
          </div>
          {content.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-500">
              {isStudent
                ? "No published content yet."
                : "No modules yet. Add a module to start building the course."}
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-100">
              {content.map((module) => (
                <li key={module.module_id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900">
                        {module.position}. {module.title}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {module.lessons.length}{" "}
                        {module.lessons.length === 1 ? "lesson" : "lessons"}
                      </span>
                      {canWriteCourse && (
                        <OrderControls
                          kind="module"
                          itemId={module.module_id}
                          position={module.position}
                          total={content.length}
                        />
                      )}
                    </div>
                    {canWriteCourse && (
                      <ModuleForm
                        courseId={course.course_id}
                        moduleId={module.module_id}
                        initialTitle={module.title}
                      />
                    )}
                  </div>
                  {module.lessons.length > 0 && (
                    <ul className="mt-2 space-y-1 pl-4">
                      {module.lessons.map((lesson) => (
                        <li
                          key={lesson.lesson_id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-50"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {isStudent && studentProgress && (
                              <span
                                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                                  studentProgress.map.get(lesson.lesson_id) ===
                                  "completed"
                                    ? "bg-green-100 text-green-700"
                                    : studentProgress.map.get(
                                          lesson.lesson_id
                                        ) === "in_progress"
                                      ? "bg-zinc-200 text-zinc-700"
                                      : "border border-zinc-300 text-zinc-400"
                                }`}
                                title={
                                  studentProgress.map.get(lesson.lesson_id) ===
                                  "completed"
                                    ? "Completed"
                                    : studentProgress.map.get(
                                          lesson.lesson_id
                                        ) === "in_progress"
                                      ? "In progress"
                                      : "Not started"
                                }
                              >
                                {studentProgress.map.get(lesson.lesson_id) ===
                                "completed"
                                  ? "✓"
                                  : studentProgress.map.get(
                                        lesson.lesson_id
                                      ) === "in_progress"
                                    ? "●"
                                    : "○"}
                              </span>
                            )}
                            <Link
                              href={`/dashboard/courses/${course.course_id}/lessons/${lesson.lesson_id}`}
                              className="truncate text-sm text-zinc-700 underline-offset-4 hover:text-zinc-900 hover:underline"
                            >
                              {lesson.position}. {lesson.title}
                            </Link>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                lesson.is_published
                                  ? "bg-green-100 text-green-700"
                                  : "bg-zinc-100 text-zinc-500"
                              }`}
                            >
                              {lesson.is_published ? "published" : "draft"}
                            </span>
                          </div>
                          {canWriteCourse && (
                            <div className="flex flex-wrap items-center gap-2">
                              <OrderControls
                                kind="lesson"
                                itemId={lesson.lesson_id}
                                position={lesson.position}
                                total={module.lessons.length}
                              />
                              <PublishToggle
                                lessonId={lesson.lesson_id}
                                isPublished={lesson.is_published}
                              />
                              <LessonForm
                                courseId={course.course_id}
                                moduleId={module.module_id}
                                lessonId={lesson.lesson_id}
                                initialTitle={lesson.title}
                                initialContent={lessonContents.get(lesson.lesson_id) ?? ""}
                                initialPublished={lesson.is_published}
                              />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {canWriteCourse && (
                    <div className="mt-2 pl-4">
                      <LessonForm
                        courseId={course.course_id}
                        moduleId={module.module_id}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 rounded-md border border-zinc-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Quizzes</h2>
            {canWriteCourse && <QuizForm courseId={course.course_id} />}
          </div>
          {quizzes.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-500">
              {isStudent
                ? "No quizzes available yet."
                : "No quizzes yet. Add a quiz to test your learners."}
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-100">
              {quizzes.map((quiz) => {
                const questionCount = quiz.quiz_questions?.[0]?.count ?? 0;
                const attemptCount = quiz.quiz_attempts?.[0]?.count ?? 0;
                let studentAttemptState: {
                  inProgress: boolean;
                  latest: {
                    score: number;
                    max_score: number;
                    pct: number;
                    passed: boolean;
                  } | null;
                } | null = null;
                if (isStudent && studentProgress) {
                  const attempts =
                    studentProgress.attemptsByQuiz.get(quiz.quiz_id) ?? [];
                  const inProgress = attempts.some(
                    (attempt) => attempt.submitted_at === null
                  );
                  const latest = attempts
                    .filter(
                      (attempt) =>
                        attempt.submitted_at !== null &&
                        attempt.score !== null &&
                        attempt.max_score !== null
                    )
                    .sort((a, b) =>
                      a.started_at < b.started_at ? 1 : -1
                    )[0];
                  studentAttemptState = {
                    inProgress,
                    latest: latest
                      ? {
                          score: latest.score as number,
                          max_score: latest.max_score as number,
                          pct: Math.round(
                            ((latest.score as number) /
                              (latest.max_score as number)) *
                              100
                          ),
                          passed:
                            Math.round(
                              ((latest.score as number) /
                                (latest.max_score as number)) *
                                100
                            ) >= quiz.pass_threshold,
                        }
                      : null,
                  };
                }
                return (
                  <li
                    key={quiz.quiz_id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Link
                        href={`/dashboard/courses/${course.course_id}/quizzes/${quiz.quiz_id}`}
                        className="truncate text-sm text-zinc-700 underline-offset-4 hover:text-zinc-900 hover:underline"
                      >
                        {quiz.title}
                      </Link>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          quiz.is_published
                            ? "bg-green-100 text-green-700"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {quiz.is_published ? "published" : "draft"}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs text-zinc-400">
                      <span>
                        {questionCount}{" "}
                        {questionCount === 1 ? "question" : "questions"}
                      </span>
                      {!isStudent && (
                        <span>
                          {attemptCount}{" "}
                          {attemptCount === 1 ? "attempt" : "attempts"}
                        </span>
                      )}
                      {isStudent && studentAttemptState && (
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                            studentAttemptState.inProgress
                              ? "bg-zinc-100 text-zinc-700"
                              : studentAttemptState.latest
                                ? studentAttemptState.latest.passed
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                                : "bg-zinc-50 text-zinc-400"
                          }`}
                        >
                          {studentAttemptState.inProgress
                            ? "In progress"
                            : studentAttemptState.latest
                              ? `${studentAttemptState.latest.pct}% — ${
                                  studentAttemptState.latest.passed
                                    ? "passed"
                                    : "not passed"
                                }`
                              : "Not attempted"}
                        </span>
                      )}
                      <span>pass {quiz.pass_threshold}%</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {isStudent ? (
          <div className="mt-4 rounded-md border border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Your enrollment
            </h2>
            {ownEnrollment ? (
              <div className="mt-2 flex items-center gap-2 text-sm text-zinc-600">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${enrollmentBadgeClasses(ownEnrollment.status)}`}
                >
                  {ownEnrollment.status}
                </span>
                <span>
                  Enrolled {formatDateTime(ownEnrollment.created_at)}
                </span>
              </div>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">
                You are not enrolled in this course. Contact your organization
                to request enrollment.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="mt-4 rounded-md border border-zinc-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-900">
                Enrollments
              </h2>
              {enrollments.length > 0 ? (
                <ul className="mt-2 divide-y divide-zinc-100">
                  {enrollments.slice(0, 100).map((enrollment) => (
                    <li
                      key={enrollment.enrollment_id}
                      className="flex flex-wrap items-center justify-between gap-3 py-2"
                    >
                      <div className="text-sm">
                        <Link
                          href={`/dashboard/students/${enrollment.student_id}`}
                          className="font-medium text-zinc-900 underline-offset-4 hover:underline"
                        >
                          {enrollment.students?.first_name}{" "}
                          {enrollment.students?.last_name}
                        </Link>
                        <p className="text-xs text-zinc-400">
                          {enrollment.students?.email ?? ""}
                          {enrollment.students?.email ? " · " : ""}
                          Enrolled {formatDateTime(enrollment.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${enrollmentBadgeClasses(enrollment.status)}`}
                        >
                          {enrollment.status}
                        </span>
                        {(() => {
                          const row = analyticsByEnrollment.get(
                            enrollment.enrollment_id
                          );
                          if (!row || row.totalPublishedLessons === 0) {
                            return null;
                          }
                          return (
                            <span className="text-xs text-zinc-400">
                              {row.completedLessons}/{row.totalPublishedLessons}{" "}
                              lessons · {row.completionPercent}%
                            </span>
                          );
                        })()}
                        {enrollment.ended_at && (
                          <span className="text-xs text-zinc-400">
                            ended {formatDateTime(enrollment.ended_at)}
                          </span>
                        )}
                        {canWriteEnrollment && (
                          <EnrollmentStatusControl
                            enrollmentId={enrollment.enrollment_id}
                            status={enrollment.status}
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-zinc-500">
                  No students enrolled yet.
                </p>
              )}
            </div>

            {canWriteEnrollment && (
              <div className="mt-4 rounded-md border border-zinc-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Enroll a student
                </h2>
                {course.status === "archived" ? (
                  <p className="mt-1 text-sm text-zinc-500">
                    This course is archived and cannot be enrolled.
                  </p>
                ) : (
                  <div className="mt-2">
                    <EnrollStudentForm
                      courseId={course.course_id}
                      students={(studentsRes.data ?? []) as StudentOption[]}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <Link
          href="/dashboard/courses"
          className="mt-6 inline-block rounded-md px-3 py-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
        >
          Back to courses
        </Link>
      </div>
    </div>
  );
}
