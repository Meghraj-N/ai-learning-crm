import Link from "next/link";
import { requireStaffContext } from "@/lib/crm";
import { LEAD_STATUSES, type LeadStatus } from "@/types/crm";
import AccessDenied from "../access-denied";
import { statusBadgeClasses } from "./status-badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, Plus, Filter, Users, X } from "lucide-react";

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
    <div className="flex flex-1 flex-col pb-12 w-full animate-in fade-in duration-500 max-w-[1440px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            Leads
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Track prospects and follow-ups in your organization.
          </p>
        </div>
        <Button asChild className="shrink-0 bg-[var(--color-text-primary)] text-[var(--color-background)] hover:bg-[var(--color-text-secondary)]">
          <Link href="/dashboard/leads/new">
            <Plus className="w-4 h-4 mr-2" />
            New lead
          </Link>
        </Button>
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 mb-8 flex flex-wrap items-center gap-4">
        <form method="get" className="flex flex-wrap items-center gap-3 w-full">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search name, email, phone…"
              className="block w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] pl-10 pr-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none transition-all"
            />
          </div>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none transition-all"
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
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none transition-all"
          >
            <option value="">All assignments</option>
            <option value="unassigned">Unassigned</option>
            {activeMembers.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.full_name}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          {hasFilters && (
            <Button asChild variant="ghost" size="sm" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
              <Link href="/dashboard/leads">
                <X className="w-4 h-4 mr-2" />
                Clear
              </Link>
            </Button>
          )}
        </form>
      </div>

      {error ? (
        <EmptyState
          icon={Users}
          title="Unable to load leads"
          description="There was a problem loading the leads. Please try again."
        />
      ) : leads && leads.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => {
                  const last = lastActivities.get(lead.lead_id);
                  return (
                    <TableRow key={lead.lead_id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/leads/${lead.lead_id}`}
                          className="font-medium text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors"
                        >
                          {lead.first_name} {lead.last_name}
                        </Link>
                        {lead.source && (
                          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{lead.source}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-[var(--color-text-secondary)]">
                        {lead.email && <p>{lead.email}</p>}
                        {lead.phone && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{lead.phone}</p>}
                        {!lead.email && !lead.phone && <span className="text-[var(--color-text-muted)]">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadgeClasses(lead.status)}>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[var(--color-text-secondary)]">
                        {lead.assigned_to
                          ? memberMap.get(lead.assigned_to) ?? "—"
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-[var(--color-text-secondary)]">
                        {last ? (
                          <>
                            <span className="capitalize text-[var(--color-text-primary)] font-medium">{last.activity_type}</span>
                            <span className="ml-1 text-[var(--color-text-muted)]">
                              · {new Date(last.occurred_at).toLocaleDateString("en-GB")}
                            </span>
                          </>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-[var(--color-text-secondary)]">
                        {new Date(lead.created_at).toLocaleDateString("en-GB")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)] px-1">
            <p>
              Showing {totalCount} {totalCount === 1 ? "lead" : "leads"}
              {hasFilters ? " (filtered)" : ""}
            </p>
            {totalPages > 1 && (
              <nav className="flex items-center gap-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                >
                  <Link href={filterHref({ page: String(Math.max(1, page - 1)) })}>
                    Previous
                  </Link>
                </Button>
                <span className="px-2 font-medium text-[var(--color-text-primary)]">
                  Page {page} of {totalPages}
                </span>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                >
                  <Link href={filterHref({ page: String(Math.min(totalPages, page + 1)) })}>
                    Next
                  </Link>
                </Button>
              </nav>
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title={hasFilters ? "No leads match your filters" : "No leads yet"}
          description={hasFilters ? "Try adjusting your search or filters to find what you're looking for." : "Create your first lead to start tracking prospects."}
          action={
            hasFilters ? (
              <Button asChild variant="outline">
                <Link href="/dashboard/leads">Clear filters</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/dashboard/leads/new">Create first lead</Link>
              </Button>
            )
          }
        />
      )}
    </div>
  );
}