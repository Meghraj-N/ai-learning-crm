import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { isCrmRole, requireStudentContext } from "@/lib/crm";
import { deriveNextAction, type NextLearningAction } from "@/lib/progress";
import {
  deriveCourseReadiness,
  pickPrimaryReadiness,
  recommendedActionHref,
  recommendedActionLabel,
  type CourseReadiness,
} from "@/lib/readiness";
import {
  loadStudentLearningData,
  type StudentLearningData,
} from "@/lib/analytics";
import { MetricCard, MetricGrid, ProgressBar } from "./analytics/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertCircle, User, Users, LineChart, BookOpen, ChevronRight, GraduationCap } from "lucide-react";
import LogoutButton from "./logout-button";

function AccessMessage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6 h-full min-h-[60vh]">
      <EmptyState
        icon={AlertCircle}
        title={title}
        description={message}
        action={<LogoutButton />}
      />
    </div>
  );
}

function StatCard({
  href,
  label,
  value,
  icon: Icon,
}: {
  href: string;
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <Link href={href} className="block group">
      <Card className="transition-all hover:bg-[#181B21] hover:border-[#6366F1]/50 border-transparent bg-[#111318]">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#A1A1AA] group-hover:text-[#F4F4F5] transition-colors">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-[#F4F4F5]">{value}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-[#181B21] flex items-center justify-center text-[#6366F1] group-hover:scale-110 transition-transform">
            <Icon className="h-6 w-6" />
          </div>
        </CardContent>
      </Card>
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

  const [totalLeads, newLeads, pipelineLeads, , studentCount] =
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
        const courseQuizzes = data.quizzes
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
    <div className="flex flex-col gap-8 pb-12 w-full animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#F4F4F5]">
            Welcome back, {profile.full_name.split(' ')[0]}
          </h1>
          <p className="mt-2 text-sm text-[#A1A1AA]">
            Here is what&apos;s happening with your learning and CRM today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs px-3 py-1">
            <User className="w-3 h-3 mr-2" />
            {profile.role}
          </Badge>
          <Badge variant="outline" className="text-xs px-3 py-1">
            {organization?.name ?? "No Organization"}
          </Badge>
        </div>
      </div>

      {showCrm && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#F4F4F5] tracking-tight">
              CRM Overview
            </h2>
            <Link href="/dashboard/leads" className="text-sm font-medium text-[#6366F1] hover:text-[#4F46E5] transition-colors inline-flex items-center">
              View all leads <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              href="/dashboard/leads"
              label="Total Leads"
              value={totalLeads?.count ?? 0}
              icon={Users}
            />
            <StatCard
              href="/dashboard/leads?status=new"
              label="New Leads"
              value={newLeads?.count ?? 0}
              icon={User}
            />
            <StatCard
              href="/dashboard/leads"
              label="Pipeline"
              value={pipelineLeads?.count ?? 0}
              icon={LineChart}
            />
            <StatCard
              href="/dashboard/students"
              label="Students"
              value={studentCount?.count ?? 0}
              icon={GraduationCap}
            />
          </div>
        </section>
      )}

      {isStudent && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content Area (2/3 width on desktop) */}
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="text-lg font-semibold text-[#F4F4F5] tracking-tight mb-4">
                My Courses
              </h2>
              {enrolledCourses.length > 0 ? (
                <div className="grid gap-4">
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
                          ? `Continue ${course.nextAction.lessonTitle}`
                          : `Start ${course.nextAction.lessonTitle}`
                        : course.nextAction?.kind === "quiz"
                          ? `Take quiz: ${course.nextAction.quizTitle}`
                          : null;
                    
                    return (
                      <Card key={course.enrollment_id} className="overflow-hidden hover:border-[#6366F1]/50 transition-colors">
                        <CardContent className="p-0">
                          <div className="p-6">
                            <div className="flex items-start justify-between gap-4 mb-6">
                              <div>
                                <Link
                                  href={`/dashboard/courses/${course.course_id}`}
                                  className="text-lg font-medium text-[#F4F4F5] hover:text-[#6366F1] transition-colors"
                                >
                                  {course.title}
                                </Link>
                                <p className="text-sm text-[#A1A1AA] mt-1">
                                  {course.completed} of {course.total} lessons completed
                                </p>
                              </div>
                              {course.total > 0 && (
                                <div className="text-right">
                                  <span className="text-2xl font-bold text-[#F4F4F5]">
                                    {course.percent}%
                                  </span>
                                </div>
                              )}
                            </div>

                            {course.total > 0 ? (
                              <div className="space-y-6">
                                <ProgressBar percent={course.percent} tone="indigo" />
                                
                                <div className="flex items-center justify-between">
                                  {course.nextAction?.kind === "completed" ? (
                                    <Badge variant="success">Course completed</Badge>
                                  ) : actionHref ? (
                                    <Button asChild size="sm">
                                      <Link href={actionHref}>
                                        {actionLabel} <ChevronRight className="w-4 h-4 ml-1" />
                                      </Link>
                                    </Button>
                                  ) : (
                                    <span />
                                  )}
                                </div>
                              </div>
                            ) : (
                              <p className="mt-1 text-xs text-[#A1A1AA]">
                                No lessons available yet.
                              </p>
                            )}
                          </div>
                          
                          {/* Readiness breakdown attached to course */}
                          <div className="bg-[#09090B] px-6 py-4 border-t border-[#272B33] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-[#A1A1AA]">Readiness:</span>
                              <Badge variant={course.readiness.state === "passed" || course.readiness.state === "completed" ? "success" : course.readiness.state === "needs_review" ? "warning" : "default"}>
                                {course.readiness.label}
                              </Badge>
                            </div>
                            {course.readiness.quizzes.length > 0 && (
                              <div className="text-xs text-[#A1A1AA]">
                                {course.readiness.passedQuizzes} / {course.readiness.availableQuizzes} Quizzes Passed
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title="No active courses"
                  description="You are not enrolled in any active courses yet. Check back later or contact your administrator."
                />
              )}
            </section>

            {learningAnalytics && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-[#F4F4F5] tracking-tight">
                    Learning Analytics
                  </h2>
                </div>
                {learningAnalytics.totalEnrolledCourses > 0 ? (
                  <MetricGrid>
                    <MetricCard
                      label="Enrolled"
                      value={learningAnalytics.totalEnrolledCourses}
                    />
                    <MetricCard
                      label="Completed"
                      value={learningAnalytics.completedCourses}
                    />
                    <MetricCard
                      label="Overall Progress"
                      value={`${learningAnalytics.overallCompletionPercent}%`}
                    />
                    <MetricCard
                      label="Pass Rate"
                      value={
                        learningAnalytics.quizPassRate === null
                          ? "—"
                          : `${learningAnalytics.quizPassRate}%`
                      }
                    />
                  </MetricGrid>
                ) : (
                  <EmptyState 
                    icon={LineChart}
                    title="No analytics yet"
                    description="Learning analytics will appear once you start making progress in a course."
                    className="min-h-[200px]"
                  />
                )}
              </section>
            )}
          </div>

          {/* Sidebar Area (1/3 width on desktop) */}
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold text-[#F4F4F5] tracking-tight mb-4">
                Primary Action
              </h2>
              {enrolledCourses.length > 0 ? (
                <>
                  {primaryReadiness ? (
                    <Card className="bg-[#6366F1]/10 border-[#6366F1]/20">
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-1">
                              <Badge variant={primaryReadiness.state === "passed" || primaryReadiness.state === "completed" ? "success" : primaryReadiness.state === "needs_review" ? "warning" : "default"}>
                                {primaryReadiness.label}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium text-[#F4F4F5] leading-relaxed">
                              {primaryReadiness.message}
                            </p>
                          </div>
                          {(() => {
                            const course = enrolledCourses.find(
                              (c) => c.readiness === primaryReadiness
                            );
                            const href = recommendedActionHref(
                              course?.course_id ?? "",
                              primaryReadiness.recommendedAction
                            );
                            const label = recommendedActionLabel(
                              primaryReadiness.recommendedAction
                            );
                            return href && label ? (
                              <Button asChild className="w-full mt-2">
                                <Link href={href}>
                                  {label} <ChevronRight className="w-4 h-4 ml-1" />
                                </Link>
                              </Button>
                            ) : null;
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <p className="text-sm text-[#A1A1AA]">
                          All your active courses are complete. Great work.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-sm text-[#A1A1AA]">
                      No actions required at this time.
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>

        </div>
      )}
    </div>
  );
}