import Link from "next/link";
import { requireStudentViewContext } from "@/lib/crm";
import {
  buildLearningTimeline,
  loadStudentLearningData,
  quizPercentage,
  type LearningTimelineEvent,
  type StudentLearningData,
} from "@/lib/analytics";
import type { EnrollmentStatus, Student } from "@/types/crm";
import AccessDenied from "../../access-denied";
import {
  AnalyticsSection,
  EmptyState,
  MetricCard,
  MetricGrid,
} from "../../analytics/ui";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function enrollmentBadgeClasses(status: EnrollmentStatus): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "paused":
      return "bg-amber-100 text-amber-700";
    case "completed":
      return "bg-blue-100 text-blue-700";
    case "cancelled":
      return "bg-zinc-100 text-zinc-500";
  }
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

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireStudentViewContext();
  if (!ctx) {
    return <AccessDenied />;
  }

  const { id } = await params;

  const { data: student, error } = await ctx.supabase
    .from("students")
    .select(
      "student_id, organization_id, profile_id, first_name, last_name, email, phone, notes, created_by, created_at, updated_at, deleted_at"
    )
    .eq("student_id", id)
    .is("deleted_at", null)
    .maybeSingle<Student>();

  if (error || !student) {
    console.error("StudentDetail: student not found", id, error?.message);
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Student not found
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            The student you are looking for does not exist or is no longer
            available.
          </p>
          <Link
            href="/dashboard/students"
            className="mt-6 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Back to students
          </Link>
        </div>
      </div>
    );
  }

  const [orgRes, leadRes, creatorRes, profileRes] = await Promise.all([
    ctx.supabase
      .from("organizations")
      .select("name")
      .eq("organization_id", ctx.organizationId)
      .maybeSingle<{ name: string }>(),
    ctx.supabase
      .from("leads")
      .select("lead_id, converted_at")
      .eq("student_id", student.student_id)
      .is("deleted_at", null)
      .maybeSingle<{ lead_id: string; converted_at: string | null }>(),
    student.created_by
      ? ctx.supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("user_id", student.created_by)
          .maybeSingle<{ user_id: string; full_name: string }>()
      : Promise.resolve({ data: null, error: null }),
    student.profile_id
      ? ctx.supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .eq("user_id", student.profile_id)
          .maybeSingle<{ user_id: string; full_name: string; email: string }>()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (orgRes.error) {
    console.error("StudentDetail: org query failed", orgRes.error.message);
  }
  if (leadRes.error) {
    console.error("StudentDetail: lead query failed", leadRes.error.message);
  }
  if (creatorRes.error) {
    console.error("StudentDetail: creator query failed", creatorRes.error.message);
  }
  if (profileRes.error) {
    console.error("StudentDetail: profile query failed", profileRes.error.message);
  }

  const organization = orgRes.data;
  const lead = leadRes.data;
  const creator = creatorRes.data;
  const profile = profileRes.data;

  const learning: StudentLearningData = await loadStudentLearningData(
    ctx.supabase,
    student.student_id
  );

  const courseByEnrollment = new Map(
    learning.courses.map((course) => [course.enrollment_id, course])
  );

  const publishedLessonIdsByCourse = new Map<string, Set<string>>();
  for (const [courseId, content] of learning.contents) {
    publishedLessonIdsByCourse.set(
      courseId,
      new Set(
        content
          .flatMap((module) => module.lessons)
          .filter((lesson) => lesson.is_published)
          .map((lesson) => lesson.lesson_id)
      )
    );
  }
  const lessonTitles = new Map<string, string>();
  for (const content of learning.contents.values()) {
    for (const lesson of content.flatMap((module) => module.lessons)) {
      lessonTitles.set(lesson.lesson_id, lesson.title);
    }
  }

  const courseCompletedAt = new Map<string, string | null>();
  for (const enrollment of learning.courses) {
    if (!enrollment.isComplete) {
      courseCompletedAt.set(enrollment.enrollment_id, null);
      continue;
    }
    const publishedIds =
      publishedLessonIdsByCourse.get(enrollment.course_id) ?? new Set<string>();
    const completedAt = learning.progressRows
      .filter(
        (row) =>
          row.enrollment_id === enrollment.enrollment_id &&
          row.status === "completed" &&
          publishedIds.has(row.lesson_id) &&
          row.completed_at !== null
      )
      .map((row) => row.completed_at as string);
    courseCompletedAt.set(
      enrollment.enrollment_id,
      completedAt.length > 0 ? completedAt.reduce((a, b) => (a > b ? a : b)) : null
    );
  }

  const enrollmentById = new Map(
    learning.enrollments.map((enrollment) => [
      enrollment.enrollment_id,
      enrollment,
    ])
  );
  const lessonEvents = learning.progressRows.flatMap((row) => {
    const enrollment = enrollmentById.get(row.enrollment_id);
    if (!enrollment) {
      return [];
    }
    const publishedIds = publishedLessonIdsByCourse.get(enrollment.course_id);
    if (!publishedIds || !publishedIds.has(row.lesson_id)) {
      return [];
    }
    const lessonTitle = lessonTitles.get(row.lesson_id) ?? "Lesson";
    return [
      {
        enrollment_id: row.enrollment_id,
        course_id: enrollment.course_id,
        course_title: enrollment.course_title,
        lesson_title: lessonTitle,
        started_at: row.started_at,
        completed_at: row.completed_at,
      },
    ];
  });

  const quizEvents = learning.attempts.map((attempt) => {
    const pct = quizPercentage(attempt.score, attempt.max_score);
    return {
      course_id: attempt.course_id,
      course_title: attempt.course_title,
      quiz_title: attempt.quiz_title,
      started_at: attempt.started_at,
      submitted_at: attempt.submitted_at,
      submittedPercent: pct,
      passed:
        pct !== null && attempt.submitted_at !== null && pct >= attempt.pass_threshold,
    };
  });

  const timeline: LearningTimelineEvent[] = buildLearningTimeline(
    learning.courses.map((course) => ({
      enrollment_id: course.enrollment_id,
      course_id: course.course_id,
      course_title: course.course_title,
      created_at: course.enrolled_at,
      courseCompletedAt: courseCompletedAt.get(course.enrollment_id) ?? null,
    })),
    lessonEvents,
    quizEvents
  );

  const totalQuizAttempts = learning.attempts.length;
  const submittedAttempts = learning.attempts.filter(
    (attempt) => attempt.submitted_at !== null
  );

  return (
    <div className="flex flex-1 justify-center px-4 py-8">
      <div className="w-full max-w-3xl">
        <Link
          href="/dashboard/students"
          className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline"
        >
          ← Back to students
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {student.first_name} {student.last_name}
          </h1>
          {student.profile_id && (
            <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              Account linked
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Created {formatDateTime(student.created_at)}
        </p>

        <dl className="mt-6 divide-y divide-zinc-200 rounded-md border border-zinc-200">
          <InfoRow label="Email" value={student.email ?? "—"} />
          <InfoRow label="Phone" value={student.phone ?? "—"} />
          <InfoRow
            label="Organization"
            value={organization?.name ?? "—"}
          />
          <InfoRow
            label="Created by"
            value={creator?.full_name ?? "—"}
          />
          <InfoRow
            label="Origin"
            value={
              lead ? (
                <Link
                  href={`/dashboard/leads/${lead.lead_id}`}
                  className="underline-offset-4 hover:text-zinc-900 hover:underline"
                >
                  Lead {lead.converted_at ? `(converted ${formatDateTime(lead.converted_at)})` : ""}
                </Link>
              ) : (
                "Direct record"
              )
            }
          />
          {profile && (
            <InfoRow
              label="Account"
              value={profile.email}
            />
          )}
        </dl>

        {student.notes && (
          <div className="mt-4 rounded-md border border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Notes</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">
              {student.notes}
            </p>
          </div>
        )}

        {learning.courses.length > 0 && (
          <AnalyticsSection title="Learning analytics">
            <MetricGrid>
              <MetricCard
                label="Enrolled courses"
                value={learning.courses.length}
              />
              <MetricCard
                label="Active courses"
                value={
                  learning.courses.filter(
                    (course) => course.enrollment_status === "active"
                  ).length
                }
              />
              <MetricCard
                label="Completed courses"
                value={
                  learning.courses.filter((course) => course.isComplete).length
                }
              />
              <MetricCard
                label="Overall completion"
                value={`${learning.analytics.overallCompletionPercent}%`}
              />
              <MetricCard
                label="Lessons completed"
                value={learning.analytics.publishedLessonsCompleted}
                sub={`${learning.analytics.publishedLessonsRemaining} remaining`}
              />
              <MetricCard
                label="Quizzes attempted"
                value={totalQuizAttempts}
                sub={`${submittedAttempts.length} submitted`}
              />
              <MetricCard
                label="Quizzes passed"
                value={learning.analytics.quizzesPassed}
              />
              <MetricCard
                label="Quiz pass rate"
                value={
                  learning.analytics.quizPassRate === null
                    ? "—"
                    : `${learning.analytics.quizPassRate}%`
                }
                sub={
                  learning.analytics.averageQuizScorePercent === null
                    ? undefined
                    : `Average score ${learning.analytics.averageQuizScorePercent}%`
                }
              />
            </MetricGrid>
          </AnalyticsSection>
        )}

        {learning.courses.length > 0 ? (
          <AnalyticsSection
            title="Per-course learning"
            subtitle="Progress and quiz performance for each enrollment."
          >
            <div className="overflow-x-auto rounded-md border border-zinc-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-zinc-500">Course</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">Status</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">Completion</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">Lessons</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">Quiz attempts</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">Pass rate</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">Avg score</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">Last activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {learning.courses.map((course) => (
                    <tr key={course.enrollment_id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/courses/${course.course_id}`}
                          className="font-medium text-zinc-900 underline-offset-4 hover:underline"
                        >
                          {course.course_title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${enrollmentBadgeClasses(course.enrollment_status)}`}
                        >
                          {course.enrollment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full rounded-full bg-green-500"
                              style={{
                                width: `${course.percent}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium text-zinc-900">
                            {course.percent}%
                          </span>
                        </div>
                        {course.isComplete && (
                          <p className="text-xs font-medium text-green-700">
                            ✓ Course completed
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {course.completedLessons}/{course.totalPublishedLessons}
                        <span className="text-zinc-400">
                          {" "}
                          ({course.remainingLessons} remaining)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {course.quizAttempts}
                        {course.quizSubmitted > 0 && (
                          <span className="text-zinc-400">
                            {" "}
                            ({course.quizzesPassed} passed)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {course.quizPassRate === null
                          ? "—"
                          : `${course.quizPassRate}%`}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {course.averageQuizScorePercent === null
                          ? "—"
                          : `${course.averageQuizScorePercent}%`}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {course.lastActivityAt
                          ? formatDateTime(course.lastActivityAt)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AnalyticsSection>
        ) : (
          <div className="mt-4 rounded-md border border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Learning analytics
            </h2>
            <div className="mt-2">
              <EmptyState message="This student is not enrolled in any courses yet." />
            </div>
          </div>
        )}

        <div className="mt-4 rounded-md border border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Enrollments
          </h2>
          {learning.enrollments.length > 0 ? (
            <ul className="mt-2 divide-y divide-zinc-100">
              {learning.enrollments.map((enrollment) => {
                const course = courseByEnrollment.get(
                  enrollment.enrollment_id
                );
                return (
                  <li
                    key={enrollment.enrollment_id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2"
                  >
                    <div className="text-sm">
                      <Link
                        href={`/dashboard/courses/${enrollment.course_id}`}
                        className="font-medium text-zinc-900 underline-offset-4 hover:underline"
                      >
                        {enrollment.course_title}
                      </Link>
                      <p className="text-xs text-zinc-400">
                        Enrolled {formatDateTime(enrollment.created_at)}
                        {enrollment.ended_at
                          ? ` · ended ${formatDateTime(enrollment.ended_at)}`
                          : ""}
                      </p>
                      {course && course.totalPublishedLessons > 0 && (
                        <div className="mt-2 w-48">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs text-zinc-400">
                              {course.completedLessons} of{" "}
                              {course.totalPublishedLessons} published lessons
                            </span>
                            <span className="text-xs font-medium text-zinc-900">
                              {course.percent}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full rounded-full bg-green-500"
                              style={{ width: `${course.percent}%` }}
                            />
                          </div>
                          {course.isComplete && (
                            <p className="mt-1 text-xs font-medium text-green-700">
                              ✓ Course completed
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${enrollmentBadgeClasses(enrollment.enrollment_status)}`}
                    >
                      {enrollment.enrollment_status}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-2">
              <EmptyState message="This student is not enrolled in any courses yet." />
            </div>
          )}
        </div>

        {learning.attempts.length > 0 && (
          <div className="mt-4 rounded-md border border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Quiz attempts
            </h2>
            <ul className="mt-2 divide-y divide-zinc-100">
              {learning.attempts.slice(0, 20).map((attempt) => {
                const pct = quizPercentage(attempt.score, attempt.max_score);
                const passed =
                  attempt.submitted_at !== null &&
                  pct !== null &&
                  pct >= attempt.pass_threshold;
                return (
                  <li
                    key={attempt.attempt_id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2"
                  >
                    <div className="text-sm">
                      <Link
                        href={`/dashboard/courses/${attempt.course_id}/quizzes/${attempt.quiz_id}/attempts/${attempt.attempt_id}`}
                        className="font-medium text-zinc-900 underline-offset-4 hover:underline"
                      >
                        {attempt.quiz_title}
                      </Link>
                      <p className="text-xs text-zinc-400">
                        {attempt.course_title}
                        {attempt.submitted_at !== null
                          ? ` · Submitted ${formatDateTime(attempt.submitted_at)}`
                          : " · In progress"}
                      </p>
                    </div>
                    {attempt.submitted_at !== null &&
                    attempt.score !== null &&
                    attempt.max_score !== null ? (
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
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {learning.attempts.length > 20 && (
              <p className="mt-2 text-xs text-zinc-400">
                Showing the 20 most recent attempts.
              </p>
            )}
          </div>
        )}

        {timeline.length > 0 && (
          <AnalyticsSection
            title="Learning timeline"
            subtitle="Chronological learning activity derived from existing records (newest first)."
          >
            <ol className="relative space-y-3 border-l border-zinc-200 pl-4">
              {timeline.slice(0, 100).map((event, index) => (
                <li key={index} className="text-sm">
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border border-zinc-300 bg-white" />
                  <p className="font-medium text-zinc-900">{event.label}</p>
                  <p className="text-xs text-zinc-400">
                    {formatDateTime(event.occurredAt)}
                    {event.detail ? ` · ${event.detail}` : ""}
                  </p>
                </li>
              ))}
            </ol>
            {timeline.length > 100 && (
              <p className="mt-3 text-xs text-zinc-400">
                Showing the 100 most recent events.
              </p>
            )}
          </AnalyticsSection>
        )}
      </div>
    </div>
  );
}
