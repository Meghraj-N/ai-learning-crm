import Link from "next/link";
import { requireStaffContext } from "@/lib/crm";
import {
  type Followup,
  type Lead,
  type LeadActivity,
  type LeadActivityType,
  type OrgMember,
} from "@/types/crm";
import AccessDenied from "../../access-denied";
import { statusBadgeClasses } from "../status-badge";
import StatusForm from "./status-form";
import AssignForm from "./assign-form";
import FollowupForm from "./followup-form";
import FollowupActions from "./followup-actions";
import ConvertButton from "./convert-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronLeft, User, Activity, ListTodo, Settings, CheckCircle2 } from "lucide-react";

const ACTIVITY_LABELS: Record<LeadActivityType, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
  whatsapp: "WhatsApp",
  status_change: "Status change",
  assignment: "Assignment",
  converted: "Converted",
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 hover:bg-[var(--color-surface-elevated)] transition-colors">
      <dt className="text-sm text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="text-sm font-medium text-[var(--color-text-primary)] text-right">{value}</dd>
    </div>
  );
}

function priorityClasses(priority: Followup["priority"]): string {
  switch (priority) {
    case "low":
      return "bg-[var(--color-surface-highest)] text-[var(--color-text-secondary)] border-transparent";
    case "medium":
      return "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20";
    case "high":
      return "bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20";
  }
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireStaffContext();
  if (!ctx) {
    return <AccessDenied />;
  }

  const { id } = await params;

  const { data: lead, error } = await ctx.supabase
    .from("leads")
    .select(
      "lead_id, organization_id, first_name, last_name, email, phone, source, status, score, assigned_to, student_id, converted_at, converted_by, notes, created_by, created_at, updated_at, deleted_at"
    )
    .eq("lead_id", id)
    .is("deleted_at", null)
    .maybeSingle<Lead>();

  if (error || !lead) {
    console.error("LeadDetail: lead not found", id, error?.message);
    return (
      <div className="flex flex-1 items-center justify-center p-6 h-full min-h-[60vh]">
        <EmptyState
          icon={User}
          title="Lead not found"
          description="The lead you are looking for does not exist or is no longer available."
          action={
            <Button asChild>
              <Link href="/dashboard/leads">Back to leads</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const [activitiesRes, followupsRes, membersRes] = await Promise.all([
    ctx.supabase
      .from("lead_activities")
      .select(
        "activity_id, performed_by, activity_type, occurred_at, notes, metadata"
      )
      .eq("lead_id", id)
      .order("occurred_at", { ascending: false })
      .limit(100),
    ctx.supabase
      .from("followups")
      .select(
        "followup_id, assigned_to, title, notes, due_at, priority, status, completed_at, completed_by, created_by, created_at"
      )
      .eq("lead_id", id)
      .order("due_at", { ascending: true }),
    ctx.supabase
      .from("profiles")
      .select("user_id, full_name, role, email, is_active")
      .eq("organization_id", ctx.organizationId)
      .order("full_name"),
  ]);

  const activities = (activitiesRes.data ?? []) as LeadActivity[];
  const followups = (followupsRes.data ?? []) as Followup[];
  const members = (membersRes.data ?? []) as OrgMember[];

  const memberNames = new Map(members.map((member) => [member.user_id, member.full_name]));
  const activeMembers = members.filter((member) => member.is_active);
  const nowIso = new Date().toISOString();

  return (
    <div className="flex flex-1 flex-col pb-12 w-full animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard/leads"
          className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors inline-flex items-center"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to leads
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              {lead.first_name} {lead.last_name}
            </h1>
            <Badge variant="outline" className={statusBadgeClasses(lead.status)}>
              {lead.status}
            </Badge>
            {lead.converted_at && (
              <Badge variant="success" className="bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20">
                Converted
              </Badge>
            )}
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Added on {formatDateTime(lead.created_at)}
          </p>
        </div>

        {lead.student_id ? (
          <Button asChild className="shrink-0 bg-[var(--color-success)] hover:bg-[var(--color-success)]/90 text-white border-transparent">
            <Link href={`/dashboard/students/${lead.student_id}`}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              View Student Profile
            </Link>
          </Button>
        ) : (
          <div className="shrink-0">
            <ConvertButton leadId={lead.lead_id} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Details & Settings */}
        <div className="space-y-8">
          <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
            <CardHeader className="pb-3 border-b border-[var(--color-border)]">
              <CardTitle className="flex items-center text-lg text-[var(--color-text-primary)]">
                <User className="w-5 h-5 mr-2 text-[var(--color-text-secondary)]" />
                Contact Info
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <dl className="divide-y divide-[var(--color-border)]">
                <InfoRow label="Email" value={lead.email ?? "—"} />
                <InfoRow label="Phone" value={lead.phone ?? "—"} />
                <InfoRow label="Source" value={lead.source ?? "—"} />
                <InfoRow label="Score" value={String(lead.score)} />
                <InfoRow
                  label="Assigned to"
                  value={
                    lead.assigned_to ? (memberNames.get(lead.assigned_to) ?? "—") : "Unassigned"
                  }
                />
                <InfoRow
                  label="Added by"
                  value={lead.created_by ? (memberNames.get(lead.created_by) ?? "—") : "—"}
                />
                {lead.converted_at && (
                  <>
                    <InfoRow label="Converted on" value={formatDateTime(lead.converted_at)} />
                    <InfoRow
                      label="Converted by"
                      value={
                        lead.converted_by
                          ? (memberNames.get(lead.converted_by) ?? "—")
                          : "—"
                      }
                    />
                  </>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
            <CardHeader className="pb-4 border-b border-[var(--color-border)]">
              <CardTitle className="flex items-center text-lg text-[var(--color-text-primary)]">
                <Settings className="w-5 h-5 mr-2 text-[var(--color-text-secondary)]" />
                Management
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Lead Status</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mb-3">Changes are recorded in the timeline.</p>
                {lead.status === "converted" ? (
                  <div className="bg-[var(--color-surface-elevated)] rounded-[var(--radius-md)] p-3 text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                    Converted leads keep their status permanently.
                  </div>
                ) : (
                  <div className="bg-[var(--color-surface-elevated)] rounded-[var(--radius-md)] p-1 border border-[var(--color-border)]">
                    <StatusForm leadId={lead.lead_id} currentStatus={lead.status} />
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[var(--color-border)]">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Assignment</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mb-3">Assign to an active team member.</p>
                <div className="bg-[var(--color-surface-elevated)] rounded-[var(--radius-md)] p-1 border border-[var(--color-border)]">
                  <AssignForm
                    leadId={lead.lead_id}
                    currentAssignee={lead.assigned_to}
                    members={activeMembers}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {lead.notes && (
            <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
              <CardHeader className="pb-3 border-b border-[var(--color-border)]">
                <CardTitle className="text-lg text-[var(--color-text-primary)]">Notes</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  {lead.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Tasks & Activity */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-[var(--color-border)]">
              <CardTitle className="flex items-center text-lg text-[var(--color-text-primary)]">
                <ListTodo className="w-5 h-5 mr-2 text-[var(--color-text-secondary)]" />
                Follow-ups
              </CardTitle>
              <Badge variant="secondary" className="bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]">
                {followups.filter((f) => f.status === "pending").length} pending
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-5 bg-[var(--color-surface-elevated)]/50 border-b border-[var(--color-border)]">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Add new follow-up</h3>
                <FollowupForm leadId={lead.lead_id} members={activeMembers} />
              </div>

              {followups.length === 0 ? (
                <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
                  No follow-ups for this lead yet.
                </div>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {followups.map((followup) => {
                    const isOverdue = followup.status === "pending" && followup.due_at < nowIso;
                    return (
                      <li key={followup.followup_id} className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-5 hover:bg-[var(--color-surface-elevated)]/30 transition-colors">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">
                              {followup.title}
                            </p>
                            <Badge variant="outline" className={priorityClasses(followup.priority)}>
                              {followup.priority}
                            </Badge>
                            {followup.status === "pending" && isOverdue && (
                              <Badge variant="outline" className="bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20">
                                Overdue
                              </Badge>
                            )}
                            {followup.status === "pending" && !isOverdue && (
                              <Badge variant="outline" className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20">
                                Pending
                              </Badge>
                            )}
                            {followup.status === "completed" && (
                              <Badge variant="outline" className="bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20">
                                Completed
                              </Badge>
                            )}
                            {followup.status === "cancelled" && (
                              <Badge variant="outline" className="bg-[var(--color-surface-highest)] text-[var(--color-text-secondary)] border-transparent">
                                Cancelled
                              </Badge>
                            )}
                          </div>

                          <p className="text-xs text-[var(--color-text-muted)] mb-2 flex flex-wrap gap-2">
                            <span>Due {formatDateTime(followup.due_at)}</span>
                            {followup.assigned_to && (
                              <>
                                <span>·</span>
                                <span>Assigned to {memberNames.get(followup.assigned_to) ?? "Unknown"}</span>
                              </>
                            )}
                            {followup.completed_at && (
                              <>
                                <span>·</span>
                                <span>Completed {formatDateTime(followup.completed_at)}</span>
                              </>
                            )}
                          </p>

                          {followup.notes && (
                            <div className="mt-2 text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-elevated)] rounded-[var(--radius-md)] p-3 border border-[var(--color-border)]/50">
                              {followup.notes}
                            </div>
                          )}
                        </div>

                        {followup.status === "pending" && (
                          <div className="shrink-0 mt-2 sm:mt-0">
                            <FollowupActions followupId={followup.followup_id} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-[var(--color-border)]">
              <CardTitle className="flex items-center text-lg text-[var(--color-text-primary)]">
                <Activity className="w-5 h-5 mr-2 text-[var(--color-text-secondary)]" />
                Activity Timeline
              </CardTitle>
              <Badge variant="secondary" className="bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]">
                {activities.length} entries
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {activities.length === 0 ? (
                <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
                  No activity recorded for this lead yet.
                </div>
              ) : (
                <div className="p-5">
                  <div className="relative border-l border-[var(--color-border)] ml-3 space-y-6 pb-4">
                    {activities.map((activity) => (
                      <div key={activity.activity_id} className="relative pl-6">
                        <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-[var(--color-primary)] ring-4 ring-[var(--color-surface)]" />

                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">
                              {ACTIVITY_LABELS[activity.activity_type]}
                            </p>
                            <span className="text-xs text-[var(--color-text-muted)]">
                              {formatDateTime(activity.occurred_at)}
                            </span>
                          </div>

                          <p className="text-xs text-[var(--color-text-secondary)]">
                            by {activity.performed_by
                              ? memberNames.get(activity.performed_by) ?? "Unknown"
                              : "System"}
                          </p>

                          {activity.activity_type === "status_change" &&
                          activity.metadata &&
                          typeof activity.metadata.from === "string" &&
                          typeof activity.metadata.to === "string" ? (
                            <div className="mt-2 text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-elevated)] rounded-[var(--radius-md)] p-3 border border-[var(--color-border)]">
                              Status changed from <span className="font-medium text-[var(--color-text-primary)]">{activity.metadata.from}</span> to <span className="font-medium text-[var(--color-text-primary)]">{activity.metadata.to}</span>
                            </div>
                          ) : activity.notes ? (
                            <div className="mt-2 text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-elevated)] rounded-[var(--radius-md)] p-3 border border-[var(--color-border)] whitespace-pre-wrap">
                              {activity.notes}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}