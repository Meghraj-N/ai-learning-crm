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
    <div className="flex flex-1 justify-center px-4 py-8">
      <div className="w-full max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Courses
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {isStudent
                ? "Courses available to you in your organization."
                : "Manage courses and enrollments for your organization."}
            </p>
          </div>
          {canWrite && (
            <Link
              href="/dashboard/courses/new"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            >
              New course
            </Link>
          )}
        </div>

        <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
          <div className="flex-1 basis-56">
            <label htmlFor="q" className="sr-only">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search courses…"
              className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
            />
          </div>
          {!isStudent && (
            <select
              name="status"
              defaultValue={status ?? ""}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500"
            >
              <option value="">All statuses</option>
              {COURSE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          )}
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            Filter
          </button>
          {hasFilters && (
            <Link
              href="/dashboard/courses"
              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
            >
              Clear
            </Link>
          )}
        </form>

        {error ? (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">
              Unable to load courses. Please try again.
            </p>
          </div>
        ) : rows && rows.length > 0 ? (
          <>
            <div className="mt-6 overflow-x-auto rounded-md border border-zinc-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-zinc-500">Course</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">Status</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">Modules</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">Lessons</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">
                      {isStudent ? "Your enrollment" : "Enrollments"}
                    </th>
                    {!isStudent && (
                      <th className="px-4 py-3 font-medium text-zinc-500">Creator</th>
                    )}
                    <th className="px-4 py-3 font-medium text-zinc-500">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
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
                      <tr key={row.course_id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/courses/${row.course_id}`}
                            className="font-medium text-zinc-900 underline-offset-4 hover:underline"
                          >
                            {row.title}
                          </Link>
                          {row.description && (
                            <p className="max-w-md truncate text-xs text-zinc-400">
                              {row.description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-3 text-zinc-600">{moduleCount}</td>
                        <td className="px-4 py-3 text-zinc-600">{lessonCount}</td>
                        <td className="px-4 py-3">
                          {own ? (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${enrollmentBadgeClass(own.status)}`}
                            >
                              {own.status}
                            </span>
                          ) : (
                            <span className="text-zinc-400">
                              {isStudent
                                ? "Not enrolled"
                                : String(enrollmentCount ?? 0)}
                            </span>
                          )}
                        </td>
                        {!isStudent && (
                          <td className="px-4 py-3 text-zinc-600">
                            {row.created_by
                              ? creatorMap.get(row.created_by) ?? "—"
                              : "—"}
                          </td>
                        )}
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {new Date(row.created_at).toLocaleDateString("en-GB")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
              <p>
                {totalCount} {totalCount === 1 ? "course" : "courses"}
                {hasFilters ? " (filtered)" : ""}
              </p>
              {totalPages > 1 && (
                <nav className="flex items-center gap-2">
                  <Link
                    href={filterHref({ page: String(Math.max(1, page - 1)) })}
                    aria-disabled={page <= 1}
                    className={`rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors ${
                      page <= 1
                        ? "pointer-events-none opacity-40"
                        : "text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    Previous
                  </Link>
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <Link
                    href={filterHref({ page: String(Math.min(totalPages, page + 1)) })}
                    aria-disabled={page >= totalPages}
                    className={`rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors ${
                      page >= totalPages
                        ? "pointer-events-none opacity-40"
                        : "text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    Next
                  </Link>
                </nav>
              )}
            </div>
            {showCrmLink && (
              <p className="mt-4 text-sm text-zinc-500">
                <Link
                  href="/dashboard/leads"
                  className="font-medium text-zinc-700 underline-offset-4 hover:underline"
                >
                  Lead management
                </Link>{" "}
                stays in the Leads section.
              </p>
            )}
          </>
        ) : (
          <div className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-zinc-700">
              {hasFilters ? "No courses match your filters." : "No courses yet."}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {isStudent
                ? "Courses will appear here once they are published."
                : hasFilters
                  ? (
                    <Link
                      href="/dashboard/courses"
                      className="font-medium text-zinc-700 underline-offset-4 hover:underline"
                    >
                      Clear filters
                    </Link>
                  )
                  : canWrite
                    ? "Create your first course to get started."
                    : "Courses will appear here once they are created."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function enrollmentBadgeClass(status: EnrollmentStatus): string {
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
