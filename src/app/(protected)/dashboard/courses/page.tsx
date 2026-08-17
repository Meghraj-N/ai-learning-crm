import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import {
  canManageCourses,
  isCrmRole,
} from "@/lib/crm";
import { getLessonCountsByCourse } from "@/lib/courses";
import {
  COURSE_STATUSES,
  type CourseStatus,
  type EnrollmentStatus,
} from "@/types/crm";
import AccessDenied from "../access-denied";
import { StatusBadge } from "./status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, X, Plus, Filter, AlertCircle, Library } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 20;

type StaffCourseRow = {
  course_id: string;
  title: string;
  description: string | null;
  status: CourseStatus;
  created_at: string;
  created_by: string | null;
  course_modules: { count: number }[] | null;
  enrollments: { count: number }[] | null;
};

type StudentCourseRow = {
  course_id: string;
  title: string;
  description: string | null;
  status: CourseStatus;
  created_at: string;
  created_by: string | null;
  course_modules: { count: number }[] | null;
  enrollments: {
    status: EnrollmentStatus;
    ended_at: string | null;
    created_at: string;
  }[] | null;
};

export default async function CoursesPage({
  searchParams,
}: {
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
  const canWrite = canManageCourses(role);
  const showCrmLink = isCrmRole(role);

  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 100);
  const status =
    !isStudent &&
    typeof sp.status === "string" &&
    (COURSE_STATUSES as readonly string[]).includes(sp.status)
      ? (sp.status as CourseStatus)
      : null;
  const page = Math.max(
    1,
    Number.parseInt(typeof sp.page === "string" && sp.page ? sp.page : "1", 10) || 1
  );
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();

  let query = isStudent
    ? supabase
        .from("courses")
        .select(
          "course_id, title, description, status, created_at, created_by, course_modules(count), enrollments(status, ended_at, created_at)",
          { count: "exact" }
        )
    : supabase
        .from("courses")
        .select(
          "course_id, title, description, status, created_at, created_by, course_modules(count), enrollments(count)",
          { count: "exact" }
        );

  query = query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data: rows, count, error } = await query;

  const courseIds = (rows ?? []).map((row) => row.course_id);
  const [lessonCounts, creatorRes] = await Promise.all([
    getLessonCountsByCourse(supabase, courseIds),
    (() => {
      const creatorIds = [
        ...new Set(
          (rows ?? [])
            .map((row) => row.created_by)
            .filter((id): id is string => id !== null)
        ),
      ];
      return creatorIds.length > 0
        ? supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", creatorIds)
        : Promise.resolve({ data: [], error: null });
    })(),
  ]);

  if (creatorRes.error) {
    console.error("CoursesPage: creator query failed", creatorRes.error.message);
  }

  const creatorMap = new Map(
    (creatorRes.data ?? []).map((creator) => [creator.user_id, creator.full_name])
  );

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const filterHref = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        params.delete(key);
      } else if (value !== "") {
        params.set(key, value);
      }
    }
    const str = params.toString();
    return str ? `/dashboard/courses?${str}` : "/dashboard/courses";
  };

  const hasFilters = Boolean(q || status);

  return (
    <div className="flex flex-1 flex-col pb-12 w-full animate-in fade-in duration-500 max-w-6xl mx-auto px-4 mt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#F4F4F5]">
            Courses
          </h1>
          <p className="mt-2 text-sm text-[#A1A1AA]">
            {isStudent
              ? "Courses available to you in your organization."
              : "Manage courses and enrollments for your organization."}
          </p>
        </div>
        {canWrite && (
          <Button asChild className="bg-[#6366F1] text-white hover:bg-[#4F46E5] shadow-md shadow-[#6366F1]/20">
            <Link href="/dashboard/courses/new">
              <Plus className="w-4 h-4 mr-2" />
              New course
            </Link>
          </Button>
        )}
      </div>

      <Card className="bg-[#111318] border-[#272B33]">
        <div className="p-4 border-b border-[#272B33] flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-[#181B21]/50 rounded-t-xl">
          <form method="get" className="flex flex-col sm:flex-row items-center gap-3 w-full md:max-w-xl">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
              <Input
                id="q"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Search courses..."
                className="pl-9 bg-[#111318] border-[#272B33] text-[#F4F4F5] placeholder:text-[#71717A] focus-visible:ring-[#6366F1] h-10 w-full"
              />
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {!isStudent && (
                <div className="relative w-full sm:w-[160px]">
                  <select
                    name="status"
                    defaultValue={status ?? ""}
                    className="w-full h-10 appearance-none rounded-md border border-[#272B33] bg-[#111318] px-3 py-2 text-sm text-[#F4F4F5] outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]"
                  >
                    <option value="">All statuses</option>
                    {COURSE_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                  <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA] pointer-events-none" />
                </div>
              )}
              <Button type="submit" variant="secondary" className="bg-[#272B33] text-[#F4F4F5] hover:bg-[#323642] h-10 shrink-0">
                Filter
              </Button>
              {hasFilters && (
                <Button asChild variant="ghost" size="icon" className="text-[#A1A1AA] hover:text-[#F4F4F5] shrink-0 h-10 w-10">
                  <Link href="/dashboard/courses">
                    <X className="w-4 h-4" />
                    <span className="sr-only">Clear</span>
                  </Link>
                </Button>
              )}
            </div>
          </form>
          
          <div className="text-sm text-[#A1A1AA] whitespace-nowrap">
            {totalCount} {totalCount === 1 ? "course" : "courses"} {hasFilters && "(filtered)"}
          </div>
        </div>

        {error ? (
          <div className="p-8">
            <EmptyState
              icon={AlertCircle}
              title="Failed to load courses"
              description="There was an error loading the course directory. Please try again."
              action={
                <Button asChild onClick={() => window.location.reload()}>
                  <span>Try again</span>
                </Button>
              }
            />
          </div>
        ) : rows && rows.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#111318]">
                  <TableRow className="border-[#272B33] hover:bg-transparent">
                    <TableHead className="text-[#A1A1AA] font-medium h-12">Course</TableHead>
                    <TableHead className="text-[#A1A1AA] font-medium h-12">Status</TableHead>
                    <TableHead className="text-[#A1A1AA] font-medium h-12">Structure</TableHead>
                    <TableHead className="text-[#A1A1AA] font-medium h-12">
                      {isStudent ? "Your enrollment" : "Enrollments"}
                    </TableHead>
                    {!isStudent && (
                      <TableHead className="text-[#A1A1AA] font-medium h-12">Creator</TableHead>
                    )}
                    <TableHead className="text-[#A1A1AA] font-medium h-12">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const moduleCount = row.course_modules?.[0]?.count ?? 0;
                    const lessonCount = lessonCounts.get(row.course_id) ?? 0;
                    const enrollmentCount = isStudent
                      ? undefined
                      : (row as StaffCourseRow).enrollments?.[0]?.count ?? 0;
                    const own = isStudent
                      ? (row as StudentCourseRow).enrollments?.[0] ?? null
                      : null;
                    return (
                      <TableRow key={row.course_id} className="border-[#272B33] hover:bg-[#181B21]/50 group">
                        <TableCell className="py-4">
                          <Link
                            href={`/dashboard/courses/${row.course_id}`}
                            className="font-medium text-[#F4F4F5] hover:text-[#6366F1] transition-colors"
                          >
                            {row.title}
                          </Link>
                          {row.description && (
                            <p className="max-w-md truncate text-xs text-[#A1A1AA] mt-1">
                              {row.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="text-sm text-[#F4F4F5]">{moduleCount} <span className="text-[#A1A1AA]">modules</span></div>
                          <div className="text-xs text-[#71717A] mt-0.5">{lessonCount} lessons</div>
                        </TableCell>
                        <TableCell className="py-4">
                          {own ? (
                            <Badge variant="outline" className={enrollmentBadgeClass(own.status)}>
                              {own.status}
                            </Badge>
                          ) : (
                            <span className="text-[#71717A] text-sm font-medium">
                              {isStudent
                                ? "Not enrolled"
                                : String(enrollmentCount ?? 0)}
                            </span>
                          )}
                        </TableCell>
                        {!isStudent && (
                          <TableCell className="py-4 text-[#A1A1AA] text-sm">
                            {row.created_by
                              ? creatorMap.get(row.created_by) ?? "—"
                              : "—"}
                          </TableCell>
                        )}
                        <TableCell className="py-4 text-sm text-[#71717A]">
                          {new Date(row.created_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="p-4 border-t border-[#272B33] flex items-center justify-between bg-[#111318] rounded-b-xl">
              <p className="text-sm text-[#71717A]">
                Showing page {page} of {totalPages}
              </p>
              {totalPages > 1 && (
                <div className="flex gap-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className={`border-[#272B33] bg-transparent text-[#F4F4F5] hover:bg-[#272B33] ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <Link href={filterHref({ page: String(Math.max(1, page - 1)) })} aria-disabled={page <= 1}>
                      Previous
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className={`border-[#272B33] bg-transparent text-[#F4F4F5] hover:bg-[#272B33] ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <Link href={filterHref({ page: String(Math.min(totalPages, page + 1)) })} aria-disabled={page >= totalPages}>
                      Next
                    </Link>
                  </Button>
                </div>
              )}
            </div>
            
            {showCrmLink && (
              <div className="mt-4 px-4 pb-4">
                <p className="text-sm text-[#71717A]">
                  <Link
                    href="/dashboard/leads"
                    className="font-medium text-[#A1A1AA] hover:text-[#F4F4F5] hover:underline"
                  >
                    Lead management
                  </Link>{" "}
                  stays in the Leads section.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="p-12">
            <EmptyState
              icon={Library}
              title={hasFilters ? "No courses match your filters" : "No courses yet"}
              description={
                isStudent
                  ? "Courses will appear here once they are published."
                  : hasFilters
                    ? "We couldn't find any courses matching your current filters."
                    : canWrite
                      ? "Create your first course to get started with the LMS."
                      : "Courses will appear here once they are created."
              }
              action={
                hasFilters ? (
                  <Button asChild variant="outline" className="border-[#272B33] text-[#F4F4F5]">
                    <Link href="/dashboard/courses">Clear filters</Link>
                  </Button>
                ) : canWrite ? (
                  <Button asChild className="bg-[#6366F1] text-white hover:bg-[#4F46E5]">
                    <Link href="/dashboard/courses/new">
                      <Plus className="w-4 h-4 mr-2" />
                      Create first course
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function enrollmentBadgeClass(status: EnrollmentStatus): string {
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
