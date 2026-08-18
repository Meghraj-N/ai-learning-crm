import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { canManageCourses, requireStudentContext } from "@/lib/crm";
import { getCourseContent } from "@/lib/courses";
import {
  getLessonProgressMap,
  deriveProgress,
  deriveNextAction,
  type NextActionQuiz,
} from "@/lib/progress";
import type { Lesson, LessonProgressStatus } from "@/types/crm";
import { isLessonProgressStatus } from "@/types/crm";
import AccessDenied from "../../../../access-denied";
import { LessonProgressControls } from "../lesson-progress-controls";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function LessonViewPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active || !profile.organization_id) {
    return <AccessDenied />;
  }

  const role = profile.role;
  if (role === null) {
    return <AccessDenied />;
  }

  const canWriteCourse = canManageCourses(role);
  const isStudent = role === "student";

  const { id: courseId, lessonId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("lesson_id, organization_id, module_id, title, content, position, is_published, created_at, updated_at")
    .eq("lesson_id", lessonId)
    .maybeSingle<Lesson>();

  if (error || !lesson) {
    console.error("LessonView: lesson not found", lessonId, error?.message);
    return <LessonNotFound courseId={courseId} />;
  }

  const [courseRes, moduleRes, modules] = await Promise.all([
    supabase
      .from("courses")
      .select("course_id, title, status")
      .eq("course_id", courseId)
      .maybeSingle<{ course_id: string; title: string; status: string }>(),
    supabase
      .from("course_modules")
      .select("module_id, course_id, title")
      .eq("module_id", lesson.module_id)
      .maybeSingle<{ module_id: string; course_id: string; title: string }>(),
    getCourseContent(supabase, courseId),
  ]);

  if (courseRes.error) {
    console.error("LessonView: course query failed", courseRes.error.message);
  }
  if (moduleRes.error) {
    console.error("LessonView: module query failed", moduleRes.error.message);
  }

  const course = courseRes.data;
  const courseModule = moduleRes.data;

  if (!course || !courseModule || courseModule.course_id !== course.course_id) {
    return <LessonNotFound courseId={courseId} />;
  }

  const orderedLessons = modules.flatMap((mod) =>
    mod.lessons.map((l) => ({
      lesson_id: l.lesson_id,
      title: l.title,
      moduleTitle: mod.title,
      href: `/dashboard/courses/${course.course_id}/lessons/${l.lesson_id}`,
    }))
  );
  const currentIndex = orderedLessons.findIndex((l) => l.lesson_id === lesson.lesson_id);
  const prev = currentIndex > 0 ? orderedLessons[currentIndex - 1] : null;
  const next =
    currentIndex >= 0 && currentIndex < orderedLessons.length - 1
      ? orderedLessons[currentIndex + 1]
      : null;

  let enrollmentId: string | null = null;
  let currentStatus: LessonProgressStatus = "not_started";
  let completedAt: string | null = null;
  let courseProgress:
    | { completed: number; total: number; percent: number; isComplete: boolean }
    | null = null;
  let nextAction:
    | ReturnType<typeof deriveNextAction>
    | null = null;

  if (isStudent) {
    const studentCtx = await requireStudentContext();
    if (studentCtx) {
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("enrollment_id")
        .eq("course_id", course.course_id)
        .eq("student_id", studentCtx.studentId)
        .eq("status", "active")
        .maybeSingle<{ enrollment_id: string }>();

      if (enrollment) {
        enrollmentId = enrollment.enrollment_id;
        const [progressMap, progressRes, quizzesRes] = await Promise.all([
          getLessonProgressMap(supabase, enrollment.enrollment_id),
          supabase
            .from("lesson_progress")
            .select("status, completed_at")
            .eq("enrollment_id", enrollment.enrollment_id)
            .eq("lesson_id", lesson.lesson_id)
            .maybeSingle<{ status: string; completed_at: string | null }>(),
          supabase
            .from("quizzes")
            .select("quiz_id, title, pass_threshold")
            .eq("course_id", course.course_id)
            .returns<
              {
                quiz_id: string;
                title: string;
                pass_threshold: number;
              }[]
            >(),
        ]);

        if (progressRes.data) {
          currentStatus = isLessonProgressStatus(progressRes.data.status)
            ? progressRes.data.status
            : "not_started";
          completedAt = progressRes.data.completed_at;
        }

        const completedCount = [...progressMap.values()].filter(
          (status) => status === "completed"
        ).length;
        courseProgress = deriveProgress(completedCount, orderedLessons.length);

        const quizzes = quizzesRes.data ?? [];
        const quizIds = quizzes.map((quiz) => quiz.quiz_id);
        const attemptsByQuiz = new Map<string, NextActionQuiz["attempts"]>();
        if (quizIds.length > 0) {
          const { data: attempts } = await supabase
            .from("quiz_attempts")
            .select("quiz_id, submitted_at, score, max_score")
            .in("quiz_id", quizIds)
            .eq("student_id", studentCtx.studentId)
            .returns<
              {
                quiz_id: string;
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
        nextAction = deriveNextAction(modules, progressMap, courseQuizzes);
      }
    }
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-8">
      <div className="w-full max-w-3xl">
        <nav className="text-sm text-[var(--color-text-secondary)]">
          <Link
            href="/dashboard/courses"
            className="underline-offset-4 hover:text-[var(--color-text-primary)] hover:underline"
          >
            Courses
          </Link>
          {" / "}
          <Link
            href={`/dashboard/courses/${course.course_id}`}
            className="underline-offset-4 hover:text-[var(--color-text-primary)] hover:underline"
          >
            {course.title}
          </Link>
          {" / "}
          <span>{courseModule.title}</span>
          {" / "}
          <span className="text-[var(--color-text-primary)]">{lesson.title}</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            {lesson.title}
          </h1>
          {canWriteCourse && (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                lesson.is_published
                  ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                  : "bg-[var(--color-surface-highest)] text-[var(--color-text-secondary)]"
              }`}
            >
              {lesson.is_published ? "published" : "draft"}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Module {courseModule.title} · Lesson {lesson.position}
        </p>

        <div className="mt-6 rounded-md border border-[var(--color-border)] px-4 py-4">
          {lesson.content ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]">
              {lesson.content}
            </p>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No content.</p>
          )}
        </div>

        {isStudent && enrollmentId && (
          <div className="mt-6 space-y-3">
            <LessonProgressControls
              lessonId={lesson.lesson_id}
              enrollmentId={enrollmentId}
              status={currentStatus}
              completedAt={completedAt}
            />
            <div className="rounded-md border border-[var(--color-border)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Lesson readiness
                </p>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    currentStatus === "completed"
                      ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                      : currentStatus === "in_progress"
                        ? "bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)]"
                        : "bg-[var(--color-surface-highest)] text-[var(--color-text-secondary)]"
                  }`}
                >
                  {currentStatus === "completed"
                    ? "Completed"
                    : currentStatus === "in_progress"
                      ? "In progress"
                      : "Not started"}
                </span>
              </div>
              {currentStatus === "completed" && completedAt && (
                <p className="mt-1 text-xs text-[var(--color-success)]">
                  ✓ Completed {formatDateTime(completedAt)}
                </p>
              )}
              {next && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-xs text-[var(--color-text-secondary)]">Next lesson:</span>
                  <Link
                    href={next.href}
                    className="text-sm font-medium text-[var(--color-text-primary)] underline-offset-4 hover:underline"
                  >
                    {next.title} →
                  </Link>
                </div>
              )}
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Assessments are attached to this course, not to this lesson. See
                the Quizzes section on the course page for assessment readiness.
              </p>
            </div>
            {courseProgress && (
              <div className="rounded-md border border-[var(--color-border)] px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Course progress: {courseProgress.completed} of{" "}
                    {courseProgress.total} lessons completed
                  </p>
                  {courseProgress.total > 0 && (
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {courseProgress.percent}%
                    </p>
                  )}
                </div>
                {courseProgress.total > 0 && (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-highest)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-success)]"
                      style={{ width: `${courseProgress.percent}%` }}
                    />
                  </div>
                )}
              </div>
            )}
            {nextAction &&
              currentStatus === "completed" &&
              !(
                nextAction.kind === "lesson" &&
                nextAction.lessonId === lesson.lesson_id
              ) && (
                <div className="rounded-md border border-[var(--color-border)] px-4 py-3">
                  <p className="text-sm text-[var(--color-text-secondary)]">Next up</p>
                  {nextAction.kind === "lesson" && (
                    <Link
                      href={`/dashboard/courses/${course.course_id}/lessons/${nextAction.lessonId}`}
                      className="mt-1 inline-block rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary)]/90"
                    >
                      Continue: {nextAction.moduleTitle} →{" "}
                      {nextAction.lessonTitle}
                    </Link>
                  )}
                  {nextAction.kind === "quiz" && (
                    <Link
                      href={`/dashboard/courses/${course.course_id}/quizzes/${nextAction.quizId}`}
                      className="mt-1 inline-block rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary)]/90"
                    >
                      Take quiz: {nextAction.quizTitle}
                    </Link>
                  )}
                  {nextAction.kind === "completed" && (
                    <p className="mt-1 text-sm font-medium text-[var(--color-success)]">
                      ✓ Course completed
                    </p>
                  )}
                </div>
              )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-4">
          {prev ? (
            <Link
              href={prev.href}
              className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-highest)]"
            >
              ← {prev.title}
            </Link>
          ) : (
            <span className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-muted)]">
              ← First lesson
            </span>
          )}
          {next ? (
            <Link
              href={next.href}
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary)]/90"
            >
              {next.title} →
            </Link>
          ) : (
            <span className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-muted)]">
              Last lesson →
            </span>
          )}
        </div>

        <Link
          href={`/dashboard/courses/${course.course_id}`}
          className="mt-6 inline-block rounded-md px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          Back to course
        </Link>
      </div>
    </div>
  );
}

function LessonNotFound({ courseId }: { courseId: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          Lesson not found
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          The lesson you are looking for does not exist or is not available to
          you.
        </p>
        <Link
          href={`/dashboard/courses/${courseId}`}
          className="mt-6 inline-block rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary)]/90"
        >
          Back to course
        </Link>
      </div>
    </div>
  );
}
