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
  MetricCard,
  MetricGrid,
} from "../../analytics/ui";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, User, Mail, Phone, Building2, UserPlus, Link as LinkIcon, CheckCircle2, GraduationCap, Award, Activity } from "lucide-react";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function enrollmentBadgeClasses(status: EnrollmentStatus): string {
  switch (status) {
    case "active":
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    case "paused":
      return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    case "completed":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "cancelled":
      return "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";
  }
}

function InfoRow({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-start gap-4 px-4 py-3 sm:px-6 hover:bg-[#181B21]/50 transition-colors">
      {Icon && <Icon className="w-4 h-4 text-[#A1A1AA] mt-0.5" />}
      <dt className="text-sm font-medium text-[#A1A1AA] w-1/3 sm:w-1/4 shrink-0">{label}</dt>
      <dd className="text-sm text-[#F4F4F5]">{value}</dd>
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
        <Card className="w-full max-w-md bg-[#111318] border-[#272B33]">
          <CardHeader>
            <CardTitle className="text-xl text-[#F4F4F5]">Student not found</CardTitle>
            <CardDescription className="text-[#A1A1AA]">
              The student you are looking for does not exist or is no longer available.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-[#272B33] text-[#F4F4F5] hover:bg-[#323642]">
              <Link href="/dashboard/students">Back to students</Link>
            </Button>
          </CardContent>
        </Card>
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
    <div className="flex flex-1 flex-col pb-12 w-full animate-in fade-in duration-500 max-w-5xl mx-auto px-4">
      <div className="mb-8">
        <Link
          href="/dashboard/students"
          className="inline-flex items-center text-sm font-medium text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to students
        </Link>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-[#272B33] flex items-center justify-center text-2xl font-medium text-[#F4F4F5]">
              {student.first_name.charAt(0)}{student.last_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight text-[#F4F4F5]">
                  {student.first_name} {student.last_name}
                </h1>
                {student.profile_id && (
                  <Badge variant="success" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                    Account linked
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-[#A1A1AA]">
                Student record created {formatDateTime(student.created_at)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-[#111318] border-[#272B33]">
            <CardHeader className="border-b border-[#272B33] pb-4">
              <CardTitle className="text-lg font-medium text-[#F4F4F5]">Details</CardTitle>
            </CardHeader>
            <div className="divide-y divide-[#272B33]">
              <InfoRow icon={Mail} label="Email" value={student.email ?? "—"} />
              <InfoRow icon={Phone} label="Phone" value={student.phone ?? "—"} />
              <InfoRow icon={Building2} label="Organization" value={organization?.name ?? "—"} />
              <InfoRow icon={UserPlus} label="Created by" value={creator?.full_name ?? "—"} />
              <InfoRow
                icon={LinkIcon}
                label="Origin"
                value={
                  lead ? (
                    <Link
                      href={`/dashboard/leads/${lead.lead_id}`}
                      className="text-[#6366F1] hover:text-[#818CF8] hover:underline"
                    >
                      Lead {lead.converted_at ? `(converted ${formatDateTime(lead.converted_at)})` : ""}
                    </Link>
                  ) : (
                    "Direct record"
                  )
                }
              />
              {profile && (
                <InfoRow icon={User} label="Account" value={profile.email} />
              )}
            </div>
          </Card>

          {student.notes && (
            <Card className="bg-[#111318] border-[#272B33]">
              <CardHeader className="border-b border-[#272B33] pb-4">
                <CardTitle className="text-lg font-medium text-[#F4F4F5]">Notes</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="whitespace-pre-wrap text-sm text-[#A1A1AA]">
                  {student.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
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
              <Card className="bg-[#111318] border-[#272B33] overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-[#181B21]">
                      <TableRow className="border-[#272B33] hover:bg-transparent">
                        <TableHead className="text-[#A1A1AA] font-medium h-12">Course</TableHead>
                        <TableHead className="text-[#A1A1AA] font-medium h-12">Status</TableHead>
                        <TableHead className="text-[#A1A1AA] font-medium h-12">Completion</TableHead>
                        <TableHead className="text-[#A1A1AA] font-medium h-12">Lessons</TableHead>
                        <TableHead className="text-[#A1A1AA] font-medium h-12">Quizzes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {learning.courses.map((course) => (
                        <TableRow key={course.enrollment_id} className="border-[#272B33] hover:bg-[#181B21]/50 group">
                          <TableCell className="py-4">
                            <Link
                              href={`/dashboard/courses/${course.course_id}`}
                              className="font-medium text-[#F4F4F5] hover:text-[#6366F1] transition-colors"
                            >
                              {course.course_title}
                            </Link>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge variant="outline" className={enrollmentBadgeClasses(course.enrollment_status)}>
                              {course.enrollment_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium text-[#F4F4F5]">{course.percent}%</span>
                              </div>
                              <Progress value={course.percent} className="h-1.5 bg-[#272B33]" />
                              {course.isComplete && (
                                <p className="text-[10px] font-medium text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Completed
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-4 text-[#A1A1AA]">
                            <div className="text-sm">{course.completedLessons}/{course.totalPublishedLessons}</div>
                            <div className="text-xs text-[#71717A]">{course.remainingLessons} remaining</div>
                          </TableCell>
                          <TableCell className="py-4 text-[#A1A1AA]">
                            <div className="text-sm">{course.quizAttempts} attempts</div>
                            <div className="text-xs text-[#71717A]">{course.quizzesPassed} passed</div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </AnalyticsSection>
          ) : (
            <Card className="bg-[#111318] border-[#272B33]">
              <CardHeader>
                <CardTitle className="text-lg font-medium text-[#F4F4F5]">Learning analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <EmptyState
                  icon={GraduationCap}
                  title="No enrollments"
                  description="This student is not enrolled in any courses yet."
                />
              </CardContent>
            </Card>
          )}

          <Card className="bg-[#111318] border-[#272B33]">
            <CardHeader className="border-b border-[#272B33] pb-4">
              <CardTitle className="text-lg font-medium text-[#F4F4F5]">Enrollments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {learning.enrollments.length > 0 ? (
                <ul className="divide-y divide-[#272B33]">
                  {learning.enrollments.map((enrollment) => {
                    const course = courseByEnrollment.get(enrollment.enrollment_id);
                    return (
                      <li
                        key={enrollment.enrollment_id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-[#181B21]/50 transition-colors"
                      >
                        <div className="flex-1">
                          <Link
                            href={`/dashboard/courses/${enrollment.course_id}`}
                            className="font-medium text-[#F4F4F5] hover:text-[#6366F1] transition-colors"
                          >
                            {enrollment.course_title}
                          </Link>
                          <p className="text-xs text-[#A1A1AA] mt-1">
                            Enrolled {formatDateTime(enrollment.created_at)}
                            {enrollment.ended_at ? ` · ended ${formatDateTime(enrollment.ended_at)}` : ""}
                          </p>
                          {course && course.totalPublishedLessons > 0 && (
                            <div className="mt-3 max-w-xs space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[#A1A1AA]">
                                  {course.completedLessons} of {course.totalPublishedLessons} lessons
                                </span>
                                <span className="font-medium text-[#F4F4F5]">{course.percent}%</span>
                              </div>
                              <Progress value={course.percent} className="h-1.5 bg-[#272B33]" />
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className={enrollmentBadgeClasses(enrollment.enrollment_status)}>
                          {enrollment.enrollment_status}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="p-8">
                  <EmptyState
                    icon={GraduationCap}
                    title="No enrollments"
                    description="This student is not enrolled in any courses yet."
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {learning.attempts.length > 0 && (
            <Card className="bg-[#111318] border-[#272B33]">
              <CardHeader className="border-b border-[#272B33] pb-4">
                <CardTitle className="text-lg font-medium text-[#F4F4F5]">Recent Quiz Attempts</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-[#272B33]">
                  {learning.attempts.slice(0, 20).map((attempt) => {
                    const pct = quizPercentage(attempt.score, attempt.max_score);
                    const passed = attempt.submitted_at !== null && pct !== null && pct >= attempt.pass_threshold;
                    return (
                      <li
                        key={attempt.attempt_id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-[#181B21]/50 transition-colors"
                      >
                        <div>
                          <Link
                            href={`/dashboard/courses/${attempt.course_id}/quizzes/${attempt.quiz_id}/attempts/${attempt.attempt_id}`}
                            className="font-medium text-[#F4F4F5] hover:text-[#6366F1] transition-colors"
                          >
                            {attempt.quiz_title}
                          </Link>
                          <p className="text-xs text-[#A1A1AA] mt-1">
                            {attempt.course_title}
                            {attempt.submitted_at !== null
                              ? ` · Submitted ${formatDateTime(attempt.submitted_at)}`
                              : " · In progress"}
                          </p>
                        </div>
                        {attempt.submitted_at !== null && attempt.score !== null && attempt.max_score !== null ? (
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm font-medium text-[#F4F4F5]">
                                {attempt.score} / {attempt.max_score}
                              </div>
                              {pct !== null && <div className="text-xs text-[#A1A1AA]">{pct}%</div>}
                            </div>
                            <Badge variant="outline" className={passed ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}>
                              {passed ? "Passed" : "Not passed"}
                            </Badge>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-[#272B33] text-[#A1A1AA] border-transparent">
                            In progress
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {learning.attempts.length > 20 && (
                  <div className="p-4 border-t border-[#272B33] text-center">
                    <p className="text-xs text-[#71717A]">Showing the 20 most recent attempts.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {timeline.length > 0 && (
            <AnalyticsSection
              title="Learning timeline"
              subtitle="Chronological learning activity derived from existing records (newest first)."
            >
              <Card className="bg-[#111318] border-[#272B33] overflow-hidden">
                <CardContent className="p-6">
                  <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#272B33] before:to-transparent">
                    {timeline.slice(0, 100).map((event, index) => (
                      <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#111318] bg-[#272B33] text-[#A1A1AA] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                          {event.label.includes('Quiz') ? <Award className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-[#181B21] p-4 rounded-xl border border-[#272B33] shadow">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-[#F4F4F5]">{event.label}</span>
                            <time className="text-xs font-medium text-[#6366F1]">{formatDateTime(event.occurredAt)}</time>
                          </div>
                          {event.detail && <p className="text-sm text-[#A1A1AA]">{event.detail}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {timeline.length > 100 && (
                    <div className="mt-8 text-center">
                      <p className="text-xs text-[#71717A]">Showing the 100 most recent events.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </AnalyticsSection>
          )}
        </div>
      </div>
    </div>
  );
}
