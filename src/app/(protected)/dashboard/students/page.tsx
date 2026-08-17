import Link from "next/link";
import { requireStudentViewContext } from "@/lib/crm";
import AccessDenied from "../access-denied";

const PAGE_SIZE = 20;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireStudentViewContext();
  if (!ctx) {
    return <AccessDenied />;
  }

  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 100);
  const page = Math.max(
    1,
    Number.parseInt(typeof sp.page === "string" && sp.page ? sp.page : "1", 10) || 1
  );
  const from = (page - 1) * PAGE_SIZE;

  let query = ctx.supabase
    .from("students")
    .select(
      "student_id, first_name, last_name, email, phone, profile_id, created_by, created_at",
      { count: "exact" }
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
    );
  }

  const { data: students, count, error } = await query;

  const linkedLeads = new Map<string, string>();
  if (students && students.length > 0) {
    const { data: leads } = await ctx.supabase
      .from("leads")
      .select("lead_id, student_id")
      .in(
        "student_id",
        students.map((student) => student.student_id)
      );

    for (const lead of leads ?? []) {
      if (lead.student_id && !linkedLeads.has(lead.student_id)) {
        linkedLeads.set(lead.student_id, lead.lead_id);
      }
    }
  }

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(targetPage));
    return `/dashboard/students?${params.toString()}`;
  };

  return (
    <div className="flex flex-1 justify-center px-4 py-8">
      <div className="w-full max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Students
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Converted leads and student records in your organization.
            </p>
          </div>
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
              placeholder="Search name, email, phone…"
              className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            Search
          </button>
          {q && (
            <Link
              href="/dashboard/students"
              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
            >
              Clear
            </Link>
          )}
        </form>

        {error ? (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">
              Unable to load students. Please try again.
            </p>
          </div>
        ) : students && students.length > 0 ? (
          <>
            <div className="mt-6 overflow-x-auto rounded-md border border-zinc-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-zinc-500">Name</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">Contact</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">Source lead</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {students.map((student) => {
                    const leadId = linkedLeads.get(student.student_id);
                    return (
                      <tr key={student.student_id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/students/${student.student_id}`}
                            className="font-medium text-zinc-900 underline-offset-4 hover:underline"
                          >
                            {student.first_name} {student.last_name}
                          </Link>
                          {student.profile_id && (
                            <p className="text-xs text-zinc-400">
                              Linked to an account
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {student.email && <p>{student.email}</p>}
                          {student.phone && (
                            <p className="text-xs text-zinc-400">{student.phone}</p>
                          )}
                          {!student.email && !student.phone && (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {leadId ? (
                            <Link
                              href={`/dashboard/leads/${leadId}`}
                              className="underline-offset-4 hover:text-zinc-900 hover:underline"
                            >
                              Lead
                            </Link>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {new Date(student.created_at).toLocaleDateString("en-GB")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
              <p>
                {totalCount} {totalCount === 1 ? "student" : "students"}
                {q ? " (filtered)" : ""}
              </p>
              {totalPages > 1 && (
                <nav className="flex items-center gap-2">
                  <Link
                    href={pageHref(Math.max(1, page - 1))}
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
                    href={pageHref(Math.min(totalPages, page + 1))}
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
          </>
        ) : (
          <div className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-zinc-700">
              {q ? "No students match your search." : "No students yet."}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {q ? (
                <Link
                  href="/dashboard/students"
                  className="font-medium text-zinc-700 underline-offset-4 hover:underline"
                >
                  Clear search
                </Link>
              ) : (
                <>Students are created when a lead is converted.</>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}