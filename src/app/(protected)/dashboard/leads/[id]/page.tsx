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
    <div className="flex items-center justify-between px-4 py-3">
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="text-sm font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

function priorityClasses(priority: Followup["priority"]): string {
  switch (priority) {
    case "low":
      return "bg-zinc-100 text-zinc-500";
    case "medium":
      return "bg-blue-100 text-blue-700";
    case "high":
      return "bg-red-100 text-red-700";
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
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Lead not found
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            The lead you are looking for does not exist or is no longer
            available.
          </p>
          <Link
            href="/dashboard/leads"
            className="mt-6 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Back to leads
          </Link>
        </div>
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

  if (activitiesRes.error) {
    console.error("LeadDetail: activities query failed", id, activitiesRes.error.message);
  }
  if (followupsRes.error) {
    console.error("LeadDetail: followups query failed", id, followupsRes.error.message);
  }
  if (membersRes.error) {
    console.error("LeadDetail: members query failed", membersRes.error.message);
  }

  const activities = (activitiesRes.data ?? []) as LeadActivity[];
  const followups = (followupsRes.data ?? []) as Followup[];
  const members = (membersRes.data ?? []) as OrgMember[];

  const memberNames = new Map(members.map((member) => [member.user_id, member.full_name]));
  const activeMembers = members.filter((member) => member.is_active);
  const nowIso = new Date().toISOString();

  return (
    <div className="flex flex-1 justify-center px-4 py-8">
      <div className="w-full max-w-3xl">
        <Link
          href="/dashboard/leads"
          className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline"
        >
          ← Back to leads
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {lead.first_name} {lead.last_name}
          </h1>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClasses(lead.status)}`}
          >
            {lead.status}
          </span>
          {lead.converted_at && (
            <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              Converted
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Created {formatDateTime(lead.created_at)}
        </p>

        <dl className="mt-6 divide-y divide-zinc-200 rounded-md border border-zinc-200">
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
            label="Created by"
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

        {lead.notes && (
          <div className="mt-4 rounded-md border border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Notes</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">
              {lead.notes}
            </p>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-zinc-200 p-4">
            <h2 className="text-sm font-semibold text-zinc-900">Status</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Changes are recorded in the activity timeline.
            </p>
            <div className="mt-3">
              {lead.status === "converted" ? (
                <p className="text-sm text-zinc-500">
                  Converted leads keep their status.
                </p>
              ) : (
                <StatusForm leadId={lead.lead_id} currentStatus={lead.status} />
              )}
            </div>
          </div>
          <div className="rounded-md border border-zinc-200 p-4">
            <h2 className="text-sm font-semibold text-zinc-900">Assignment</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Assign to an active member of your organization.
            </p>
            <div className="mt-3">
              <AssignForm
                leadId={lead.lead_id}
                currentAssignee={lead.assigned_to}
                members={activeMembers}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-zinc-200 p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Conversion</h2>
          <p className="mt-1 text-xs text-zinc-500">
            A converted lead becomes a student record. Enrollment and courses
            arrive in a later phase.
          </p>
          <div className="mt-3">
            {lead.student_id ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 text-sm text-zinc-600">
                  <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Converted
                  </span>
                  This lead is linked to a student record.
                </span>
                <Link
                  href={`/dashboard/students/${lead.student_id}`}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
                >
                  View student
                </Link>
              </div>
            ) : (
              <ConvertButton leadId={lead.lead_id} />
            )}
          </div>
        </div>

        <div className="mt-8 rounded-md border border-zinc-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Follow-ups</h2>
            <span className="text-xs text-zinc-500">
              {followups.filter((followup) => followup.status === "pending").length} pending
            </span>
          </div>

          <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
            <h3 className="text-sm font-medium text-zinc-700">Add follow-up</h3>
            <div className="mt-3">
              <FollowupForm leadId={lead.lead_id} members={activeMembers} />
            </div>
          </div>

          {followups.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              No follow-ups for this lead yet.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-200">
              {followups.map((followup) => {
                const isOverdue =
                  followup.status === "pending" && followup.due_at < nowIso;
                return (
                  <li key={followup.followup_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-zinc-900">
                          {followup.title}
                        </p>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${priorityClasses(followup.priority)}`}
                        >
                          {followup.priority}
                        </span>
                        {followup.status === "pending" && isOverdue && (
                          <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                            Overdue
                          </span>
                        )}
                        {followup.status === "pending" && !isOverdue && (
                          <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            Pending
                          </span>
                        )}
                        {followup.status === "completed" && (
                          <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Completed
                          </span>
                        )}
                        {followup.status === "cancelled" && (
                          <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                            Cancelled
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        Due {formatDateTime(followup.due_at)}
                        {followup.assigned_to &&
                          ` · ${memberNames.get(followup.assigned_to) ?? "Unassigned"}`}
                        {followup.completed_at &&
                          ` · Completed ${formatDateTime(followup.completed_at)}`}
                      </p>
                      {followup.notes && (
                        <p className="mt-1 text-sm text-zinc-600">{followup.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {followup.status === "pending" && (
                        <FollowupActions followupId={followup.followup_id} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-8 rounded-md border border-zinc-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Activity</h2>
            <span className="text-xs text-zinc-500">
              {activities.length} {activities.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          {activities.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              No activity recorded for this lead yet.
            </p>
          ) : (
            <ol className="mt-4 space-y-4">
              {activities.map((activity) => (
                <li key={activity.activity_id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-zinc-300" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="text-sm font-medium text-zinc-900">
                        {ACTIVITY_LABELS[activity.activity_type]}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {activity.performed_by
                          ? memberNames.get(activity.performed_by) ?? "Unknown"
                          : "System"}
                        {" · "}
                        {formatDateTime(activity.occurred_at)}
                      </p>
                    </div>
                    {activity.activity_type === "status_change" &&
                    activity.metadata &&
                    typeof activity.metadata.from === "string" &&
                    typeof activity.metadata.to === "string" ? (
                      <p className="mt-1 text-sm text-zinc-600">
                        Status changed from{" "}
                        <span className="font-medium">{activity.metadata.from}</span> to{" "}
                        <span className="font-medium">{activity.metadata.to}</span>
                      </p>
                    ) : activity.notes ? (
                      <p className="mt-1 text-sm text-zinc-600">{activity.notes}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}