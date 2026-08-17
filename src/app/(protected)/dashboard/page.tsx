import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { isCrmRole, requireStudentContext } from "@/lib/crm";
import { deriveNextAction, type NextLearningAction } from "@/lib/progress";
import {
  deriveCourseReadiness,
  pickPrimaryReadiness,
  quizReadinessBadgeClasses,
  readinessBadgeClasses,
  recommendedActionHref,
  recommendedActionLabel,
  type CourseReadiness,
} from "@/lib/readiness";
import {
  loadStudentLearningData,
  type StudentLearningData,
} from "@/lib/analytics";
import { MetricCard, MetricGrid } from "./analytics/ui";
import LogoutButton from "./logout-button";

function AccessMessage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          AI Learning &amp; CRM Hub
        </h1>
        <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">{title}</p>
          <p className="mt-1 text-sm text-amber-800">{message}</p>
        </div>
        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: number;
}) {
  return (
    <Link
      href={href}
      className="rounded-md border border-zinc-200 bg-white px-4 py-3 transition-colors hover:bg-zinc-50"
    >
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <AccessMessage
        title="Account not provisioned"
        message="Your account is authenticated but has not been provisioned for this organization. Contact your administrator."
      />
    );
  }

  if (!profile.is_active) {
    console.error(
      "Dashboard: inactive profile blocked",
      profile.user_id,
      profile.email
    );
    return (
      <AccessMessage
        title="Account deactivated"
        message="Your account has been deactivated. Contact your administrator."
      />
    );
  }

  if (!profile.organization_id || !profile.role) {
    console.error(
      "Dashboard: profile missing organization or role",
      profile.user_id,
      profile.email
    );
    return (
      <AccessMessage
        title="Account not provisioned"
        message="Your account is authenticated but has not been provisioned for this organization. Contact your administrator."
      />
    );
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("organization_id", profile.organization_id)
    .maybeSingle<{ name: string }>();

  const showCrm = isCrmRole(profile.role);

  const [totalLeads, newLeads, pipelineLeads, pendingFollowups, studentCount] =
    showCrm
      ? await Promise.all([
          supabase
            .from("leads")
            .select("lead_id", { count: "exact", head: true })
            .is("deleted_at", null),
          supabase
            .from("leads")
            .select("lead_id", { count: "exact", head: true })
            .is("deleted_at", null)
            .eq("status", "new"),
          supabase
            .from("leads")
            .select("lead_id", { count: "exact", head: true })
            .is("deleted_at", null)
            .in("status", ["contacted", "qualified"]),
          supabase
            .from("followups")
            .select("followup_id", { count: "exact", head: true })
            .eq("status", "pending"),
          supabase
            .from("students")
            .select("student_id", { count: "exact", head: true })
            .is("deleted_at", null),
        ])
      : [null, null, null, null, null];

  const isStudent = profile.role === "student";
  const enrolledCourses: {
    enrollment_id: string;
    course_id: string;
    title: string;
    completed: number;
    total: number;
    percent: number;
    isComplete: boolean;
    nextAction: NextLearningAction | null;
    readiness: CourseReadiness;
  }[] = [];
  let studentLearning: StudentLearningData | null = null;
  if (isStudent) {
    const ctx = await requireStudentContext();
    if (ctx) {
      const data = await loadStudentLearningData(ctx.supabase, ctx.studentId);
      studentLearning = data;
      for (const enrollment of data.enrollments.filter(
        (enrollment) => enrollment.enrollment_status === "active"
      )) {
        if (data.contents.has(enrollment.course_id) === false) {
          continue;
        }
        const content = data.contents.get(enrollment.course_id) ?? [];
        const progressMap =
          data.progressMaps.get(enrollment.enrollment_id) ??
          new Map<string, "not_started" | "in_progress" | "completed">();
        const publishedLessons = content
          .flatMap((module) => module.lessons)
          .filter((lesson) => lesson.is_published);
        const total = publishedLessons.length;
        const completed = publishedLessons.filter(
          (lesson) => progressMap.get(lesson.lesson_id) === "completed"
        ).length;
        const courseQuizzes: {
          quiz_id: string;
          title: string;
          pass_threshold: number;
          attempts: {
            submitted_at: string | null;
            score: number | null;
            max_score: number | null;
          }[];
        }[] = data.quizzes
          .filter((quiz) => quiz.course_id === enrollment.course_id)
          .map((quiz) => ({
            quiz_id: quiz.quiz_id,
            title: quiz.title,
            pass_threshold: quiz.pass_threshold,
            attempts: data.attempts
              .filter((attempt) => attempt.quiz_id === quiz.quiz_id)
              .map((attempt) => ({
                submitted_at: attempt.submitted_at,
                score: attempt.score,
                max_score: attempt.max_score,
              })),
          }));
        const derived = {
          completed,
          total,
          percent: total > 0 ? Math.round((completed / total) * 100) : 0,
          isComplete: total > 0 && completed >= total,
        };
        const readiness = deriveCourseReadiness(
          content,
          progressMap,
          courseQuizzes
        );
        enrolledCourses.push({
          enrollment_id: enrollment.enrollment_id,
          course_id: enrollment.course_id,
          title: enrollment.course_title,
          ...derived,
          nextAction: deriveNextAction(content, progressMap, courseQuizzes),
          readiness,
        });
      }
    }
  }
  const learningAnalytics = studentLearning?.analytics ?? null;
  const primaryReadiness = pickPrimaryReadiness(
    enrolledCourses.map((course) => course.readiness)
  );

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className={`w-full ${isStudent ? "max-w-3xl" : "max-w-md"}`}>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          AI Learning &amp; CRM Hub
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Welcome to your workspace.
        </p>

        <dl className="mt-8 divide-y divide-zinc-200 rounded-md border border-zinc-200">
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-sm text-zinc-500">Name</dt>
            <dd className="text-sm font-medium text-zinc-900">
              {profile.full_name}
            </dd>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-sm text-zinc-500">Email</dt>
            <dd className="text-sm font-medium text-zinc-900">
              {profile.email}
            </dd>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-sm text-zinc-500">Role</dt>
            <dd className="text-sm font-medium capitalize text-zinc-900">
              {profile.role}
            </dd>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-sm text-zinc-500">Organization</dt>
            <dd className="text-sm font-medium text-zinc-900">
              {organization?.name ?? "—"}
            </dd>
          </div>
        </dl>

        {showCrm && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-zinc-900">
              CRM overview
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                href="/dashboard/leads"
                label="Total leads"
                value={totalLeads?.count ?? 0}
              />
              <StatCard
                href="/dashboard/leads?status=new"
                label="New leads"
                value={newLeads?.count ?? 0}
              />
              <StatCard
                href="/dashboard/leads"
                label="Pipeline"
                value={pipelineLeads?.count ?? 0}
              />
              <StatCard
                href="/dashboard/leads"
                label="Follow-ups due"
                value={pendingFollowups?.count ?? 0}
              />
              <StatCard
                href="/dashboard/students"
                label="Students"
                value={studentCount?.count ?? 0}
              />
            </div>
          </div>
        )}

                {isStudent && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-zinc-900">
              Learning readiness
            </h2>
            {enrolledCourses.length > 0 ? (
              <>
                {primaryReadiness ? (
                  <div className="mt-3 rounded-md border border-zinc-200 bg-white px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${readinessBadgeClasses(primaryReadiness.state)}`}
                        >
                          {primaryReadiness.label}
                        </span>
                        <span className="text-sm text-zinc-500">
                          {primaryReadiness.message}
                        </span>
                      </div>
                      {(() => {
                        const href = recommendedActionHref(
                          enrolledCourses.find(
                            (course) =>
                              course.readiness === primaryReadiness
                          )?.course_id ?? "",
                          primaryReadiness.recommendedAction
                        );
                        const label = recommendedActionLabel(
                          primaryReadiness.recommendedAction
                        );
                        return href && label ? (
                          <Link
                            href={href}
                            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
                          >
                            {label} →
                          </Link>
                        ) : null;
                      })()}
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">
                    All your active courses are complete. Great work.
                  </p>
                )}
                <ul className="mt-3 space-y-3">
                  {enrolledCourses.map((course) => (
                    <li
                      key={course.enrollment_id}
                      className="rounded-md border border-zinc-200 bg-white px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Link
                          href={`/dashboard/courses/${course.course_id}`}
                          className="text-sm font-medium text-zinc-900 underline-offset-4 hover:underline"
                        >
                          {course.title}
                        </Link>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${readinessBadgeClasses(course.readiness.state)}`}
                        >
                          {course.readiness.label}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-zinc-500">
                        <span>
                          {course.readiness.lessonsCompleted} of{" "}
                          {course.readiness.totalPublishedLessons} lessons
                          completed · {course.readiness.lessonsPercent}%
                        </span>
                        {course.readiness.quizzes.length > 0 && (
                          <span>
                            {course.readiness.passedQuizzes} passed ·{" "}
                            {course.readiness.availableQuizzes} remaining
                          </span>
                        )}
                      </div>
                      {course.readiness.quizzes.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {course.readiness.quizzes.map((quiz) => (
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
                      {course.readiness.recommendedAction &&
                        course.readiness.recommendedAction.kind !==
                          "completed" &&
                        (() => {
                          const href = recommendedActionHref(
                            course.course_id,
                            course.readiness.recommendedAction
                          );
                          const label = recommendedActionLabel(
                            course.readiness.recommendedAction
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
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">
                You are not enrolled in any active courses yet.
              </p>
            )}
          </div>
        )}

                {isStudent && learningAnalytics && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-zinc-900">
              My learning analytics
            </h2>
            {learningAnalytics.totalEnrolledCourses > 0 ? (
              <MetricGrid>
                <MetricCard
                  label="Enrolled courses"
                  value={learningAnalytics.totalEnrolledCourses}
                />
                <MetricCard
                  label="Active courses"
                  value={learningAnalytics.activeCourses}
                />
                <MetricCard
                  label="Completed courses"
                  value={learningAnalytics.completedCourses}
                />
                <MetricCard
                  label="Overall completion"
                  value={`${learningAnalytics.overallCompletionPercent}%`}
                />
                <MetricCard
                  label="Lessons completed"
                  value={learningAnalytics.publishedLessonsCompleted}
                  sub={`${learningAnalytics.publishedLessonsRemaining} remaining`}
                />
                <MetricCard
                  label="Quizzes attempted"
                  value={learningAnalytics.quizzesAttempted}
                  sub={`${learningAnalytics.quizzesSubmitted} submitted`}
                />
                <MetricCard
                  label="Quizzes passed"
                  value={learningAnalytics.quizzesPassed}
                />
                <MetricCard
                  label="Quiz pass rate"
                  value={
                    learningAnalytics.quizPassRate === null
                      ? "—"
                      : `${learningAnalytics.quizPassRate}%`
                  }
                  sub={
                    learningAnalytics.averageQuizScorePercent === null
                      ? undefined
                      : `Average score ${learningAnalytics.averageQuizScorePercent}%`
                  }
                />
              </MetricGrid>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">
                No learning analytics available yet. Analytics appear once you
                are enrolled in a course.
              </p>
            )}
          </div>
        )}

        {isStudent && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-zinc-900">My courses</h2>
            {enrolledCourses.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {enrolledCourses.map((course) => {
                  const actionHref =
                    course.nextAction?.kind === "lesson"
                      ? `/dashboard/courses/${course.course_id}/lessons/${course.nextAction.lessonId}`
                      : course.nextAction?.kind === "quiz"
                        ? `/dashboard/courses/${course.course_id}/quizzes/${course.nextAction.quizId}`
                        : null;
                  const actionLabel =
                    course.nextAction?.kind === "lesson"
                      ? course.nextAction.status === "in_progress"
                        ? `Continue: ${course.nextAction.moduleTitle} → ${course.nextAction.lessonTitle}`
                        : `Start: ${course.nextAction.moduleTitle} → ${course.nextAction.lessonTitle}`
                      : course.nextAction?.kind === "quiz"
                        ? `Take quiz: ${course.nextAction.quizTitle}`
                        : null;
                  return (
                    <li
                      key={course.enrollment_id}
                      className="rounded-md border border-zinc-200 bg-white px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <Link
                          href={`/dashboard/courses/${course.course_id}`}
                          className="text-sm font-medium text-zinc-900 underline-offset-4 hover:underline"
                        >
                          {course.title}
                        </Link>
                        {course.total > 0 && (
                          <span className="text-sm font-medium text-zinc-900">
                            {course.percent}%
                          </span>
                        )}
                      </div>
                      {course.total > 0 ? (
                        <>
                          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full rounded-full bg-green-500"
                              style={{ width: `${course.percent}%` }}
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-4">
                            <p className="text-xs text-zinc-500">
                              {course.completed} of {course.total} lessons
                              completed
                            </p>
                            {course.nextAction?.kind === "completed" && (
                              <span className="text-xs font-medium text-green-700">
                                ✓ Course completed
                              </span>
                            )}
                          </div>
                          {actionHref && (
                            <Link
                              href={actionHref}
                              className="mt-3 inline-block rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
                            >
                              {actionLabel} →
                            </Link>
                          )}
                        </>
                      ) : (
                        <p className="mt-1 text-xs text-zinc-500">
                          No lessons available yet.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">
                You are not enrolled in any active courses yet.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center gap-4">
          {profile.role === "admin" && (
            <Link
              href="/dashboard/users"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              Manage users
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}