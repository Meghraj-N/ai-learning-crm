import Link from "next/link";
import { requireStaffContext } from "@/lib/crm";
import { LEAD_STATUSES, type LeadStatus } from "@/types/crm";
import AccessDenied from "../access-denied";
import { statusBadgeClasses } from "./status-badge";

const PAGE_SIZE = 20;

type LastActivity = {
  lead_id: string;
  activity_type: string;
  occurred_at: string;
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireStaffContext();
  if (!ctx) {
    return <AccessDenied />;
  }

  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 100);
  const status =
    typeof sp.status === "string" && (LEAD_STATUSES as readonly string[]).includes(sp.status)
      ? (sp.status as LeadStatus)
      : null;
  const assigned = typeof sp.assigned === "string" ? sp.assigned : "";
  const page = Math.max(
    1,
    Number.parseInt(typeof sp.page === "string" && sp.page ? sp.page : "1", 10) || 1
  );
  const from = (page - 1) * PAGE_SIZE;

  const { data: members } = await ctx.supabase
    .from("profiles")
    .select("user_id, full_name, is_active")
    .eq("organization_id", ctx.organizationId)
    .order("full_name");

  const memberMap = new Map(
    (members ?? []).map((member) => [member.user_id, member.full_name])
  );
  const assignedValid =
    assigned === "" || assigned === "unassigned" || memberMap.has(assigned);
  const activeMembers = (members ?? []).filter((member) => member.is_active);

  let query = ctx.supabase
    .from("leads")
    .select(
      "lead_id, first_name, last_name, email, phone, source, status, score, assigned_to, created_at",
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
  if (status) {
    query = query.eq("status", status);
  }
  if (assignedValid) {
    query =
      assigned === "unassigned"
        ? query.is("assigned_to", null)
        : assigned
          ? query.eq("assigned_to", assigned)
          : query;
  }

  const { data: leads, count, error } = await query;

  const lastActivities = new Map<string, LastActivity>();
  if (leads && leads.length > 0) {
    const { data: activities } = await ctx.supabase
      .from("lead_activities")
      .select("lead_id, activity_type, occurred_at")
      .in(
        "lead_id",
        leads.map((lead) => lead.lead_id)
      )
      .order("occurred_at", { ascending: false })
      .limit(1000);

    const seen = new Set<string>();
    for (const activity of activities ?? []) {
      if (!seen.has(activity.lead_id)) {
        seen.add(activity.lead_id);
        lastActivities.set(activity.lead_id, activity as LastActivity);
      }
    }
  }

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const filterHref = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (assigned && assigned !== "") params.set("assigned", assigned);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        params.delete(key);
      } else if (value !== "") {
        params.set(key, value);
      }
    }
    const str = params.toString();
    return str ? `/dashboard/leads?${str}` : "/dashboard/leads";
  };

  const hasFilters = Boolean(q || status || assigned);

  return (
    <div className="flex flex-1 justify-center px-4 py-8">
      <div className="w-full max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Leads
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Track prospects and follow-ups in your organization.
            </p>
          </div>
          <Link
            href="/dashboard/leads/new"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            New lead
          </Link>
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
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500"
          >
            <option value="">All statuses</option>
            {LEAD_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            name="assigned"
            defaultValue={assigned}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500"
          >
            <option value="">All assignments</option>
            <option value="unassigned">Unassigned</option>
            {activeMembers.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.full_name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            Filter
          </button>
          {hasFilters && (
            <Link
              href="/dashboard/leads"
              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
            >
              Clear
            </Link>
          )}
        </form>

        {error ? (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">
              Unable to load leads. Please try again.
            </p>
          </div>
        ) : leads && leads.length > 0 ? (
          <>
            <div className="mt-6 overflow-x-auto rounded-md border border-zinc-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-zinc-500">Name</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">Contact</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">Status</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">Assigned</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">Last activity</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {leads.map((lead) => {
                    const last = lastActivities.get(lead.lead_id);
                    return (
                      <tr key={lead.lead_id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/leads/${lead.lead_id}`}
                            className="font-medium text-zinc-900 underline-offset-4 hover:underline"
                          >
                            {lead.first_name} {lead.last_name}
                          </Link>
                          {lead.source && (
                            <p className="text-xs text-zinc-400">{lead.source}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {lead.email && <p>{lead.email}</p>}
                          {lead.phone && <p className="text-xs text-zinc-400">{lead.phone}</p>}
                          {!lead.email && !lead.phone && <span className="text-zinc-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClasses(lead.status)}`}
                          >
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {lead.assigned_to
                            ? memberMap.get(lead.assigned_to) ?? "—"
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {last ? (
                            <>
                              <span className="capitalize">{last.activity_type}</span>
                              <span className="ml-1 text-zinc-400">
                                · {new Date(last.occurred_at).toLocaleDateString("en-GB")}
                              </span>
                            </>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {new Date(lead.created_at).toLocaleDateString("en-GB")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
              <p>
                {totalCount} {totalCount === 1 ? "lead" : "leads"}
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
          </>
        ) : (
          <div className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-zinc-700">
              {hasFilters ? "No leads match your filters." : "No leads yet."}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {hasFilters ? (
                <Link
                  href="/dashboard/leads"
                  className="font-medium text-zinc-700 underline-offset-4 hover:underline"
                >
                  Clear filters
                </Link>
              ) : (
                <>
                  Create your first lead to start tracking prospects.
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}