import Link from "next/link";
import { requireStudentViewContext } from "@/lib/crm";
import AccessDenied from "../access-denied";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RetryButton } from "@/components/ui/retry-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, Search, X, GraduationCap, ArrowRight, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
    <div className="flex flex-1 flex-col pb-12 w-full animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            Students
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Converted leads and enrolled students in your organization.
          </p>
        </div>
      </div>

      <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
        <div className="p-4 border-b border-[var(--color-border)] flex flex-col sm:flex-row gap-4 items-center justify-between bg-[var(--color-surface-elevated)]/50 rounded-t-[var(--radius-xl)]">
          <form method="get" className="flex items-center gap-2 w-full sm:max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
              <Input
                id="q"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Search name, email, phone..."
                className="pl-9 bg-[var(--color-background)] border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:ring-[var(--color-primary)]"
              />
            </div>
            <Button type="submit" variant="secondary" className="bg-[var(--color-surface-highest)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-highest)]/80">
              Search
            </Button>
            {q && (
              <Button asChild variant="ghost" size="icon" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <Link href="/dashboard/students">
                  <X className="w-4 h-4" />
                  <span className="sr-only">Clear</span>
                </Link>
              </Button>
            )}
          </form>

          <div className="text-sm text-[var(--color-text-secondary)] whitespace-nowrap">
            {totalCount} {totalCount === 1 ? "student" : "students"} {q && "(filtered)"}
          </div>
        </div>

        {error ? (
          <div className="p-8">
            <EmptyState
              icon={Users}
              title="Failed to load students"
              description="There was an error loading the student directory. Please try again."
              action={<RetryButton />}
            />
          </div>
        ) : students && students.length > 0 ? (
          <>
            <Table>
              <TableHeader className="bg-[var(--color-surface)]">
                <TableRow className="border-[var(--color-border)] hover:bg-transparent">
                  <TableHead className="text-[var(--color-text-secondary)] font-medium h-12">Name</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)] font-medium h-12">Contact Info</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)] font-medium h-12">Account Status</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)] font-medium h-12">Origin</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)] font-medium h-12">Added On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => {
                  const leadId = linkedLeads.get(student.student_id);
                  return (
                    <TableRow key={student.student_id} className="border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)]/50 group">
                      <TableCell className="py-4">
                        <Link
                          href={`/dashboard/students/${student.student_id}`}
                          className="font-medium text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors flex items-center"
                        >
                          <div className="w-8 h-8 rounded-full bg-[var(--color-surface-highest)] text-[var(--color-text-secondary)] flex items-center justify-center mr-3 text-xs font-medium">
                            {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                          </div>
                          {student.first_name} {student.last_name}
                        </Link>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="text-sm text-[var(--color-text-secondary)] flex flex-col gap-1">
                          {student.email && <span>{student.email}</span>}
                          {student.phone && <span className="text-xs text-[var(--color-text-muted)]">{student.phone}</span>}
                          {!student.email && !student.phone && <span>—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        {student.profile_id ? (
                          <Badge variant="success" className="bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20 gap-1.5">
                            <UserCheck className="w-3 h-3" /> Linked
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-[var(--color-surface-highest)] text-[var(--color-text-secondary)] border-transparent">
                            Unlinked
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        {leadId ? (
                          <Link
                            href={`/dashboard/leads/${leadId}`}
                            className="inline-flex items-center text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 bg-[var(--color-primary)]/10 px-2 py-1 rounded-md transition-colors"
                          >
                            View Lead <ArrowRight className="w-3 h-3 ml-1" />
                          </Link>
                        ) : (
                          <span className="text-[var(--color-text-muted)] text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-sm text-[var(--color-text-muted)]">
                        {new Date(student.created_at).toLocaleDateString("en-GB", {
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

            <div className="p-4 border-t border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface)] rounded-b-[var(--radius-xl)]">
              <p className="text-sm text-[var(--color-text-muted)]">
                Showing page {page} of {totalPages}
              </p>
              {totalPages > 1 && (
                <div className="flex gap-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className={`border-[var(--color-border)] bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-surface-highest)] ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <Link href={pageHref(Math.max(1, page - 1))} aria-disabled={page <= 1}>
                      Previous
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className={`border-[var(--color-border)] bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-surface-highest)] ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <Link href={pageHref(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages}>
                      Next
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-12">
            <EmptyState
              icon={GraduationCap}
              title={q ? "No students found" : "No students yet"}
              description={q ? "We couldn't find any students matching your search criteria." : "Students are created automatically when a lead is converted."}
              action={q ? (
                <Button asChild variant="outline" className="border-[var(--color-border)] text-[var(--color-text-primary)]">
                  <Link href="/dashboard/students">Clear search</Link>
                </Button>
              ) : undefined}
            />
          </div>
        )}
      </Card>
    </div>
  );
}