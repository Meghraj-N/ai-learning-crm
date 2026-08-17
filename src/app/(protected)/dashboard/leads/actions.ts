"use server";

import { requireStaffContext } from "@/lib/crm";
import {
  isFollowupPriority,
  isLeadStatus,
  type FollowupPriority,
  type Lead,
  type Followup,
} from "@/types/crm";export type ActionState = {
  ok: boolean;
  error: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireLead(
  ctx: NonNullable<Awaited<ReturnType<typeof requireStaffContext>>>,
  leadId: string
): Promise<{ lead: Pick<Lead, "lead_id" | "status" | "assigned_to"> } | { error: string }> {
  if (!leadId) {
    return { error: "Missing lead." };
  }

  const { data: lead, error } = await ctx.supabase
    .from("leads")
    .select("lead_id, status, assigned_to")
    .eq("lead_id", leadId)
    .is("deleted_at", null)
    .maybeSingle<Pick<Lead, "lead_id" | "status" | "assigned_to">>();

  if (error || !lead) {
    console.error("Lead action: lead not found", leadId, error?.message);
    return { error: "Lead not found." };
  }

  return { lead };
}

async function requireOrgAssignee(
  ctx: NonNullable<Awaited<ReturnType<typeof requireStaffContext>>>,
  userId: string
): Promise<{ member: { user_id: string; full_name: string } } | { error: string }> {
  const { data: member, error } = await ctx.supabase
    .from("profiles")
    .select("user_id, full_name")
    .eq("user_id", userId)
    .eq("organization_id", ctx.organizationId)
    .eq("is_active", true)
    .maybeSingle<{ user_id: string; full_name: string }>();

  if (error || !member) {
    console.error("Lead action: assignee invalid", userId, error?.message);
    return { error: "Assigned user must be an active member of your organization." };
  }

  return { member };
}

export async function createLead(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState & { leadId?: string }> {
  const ctx = await requireStaffContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!firstName) {
    return { ok: false, error: "First name is required." };
  }
  if (!lastName) {
    return { ok: false, error: "Last name is required." };
  }
  if (email && !EMAIL_RE.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const { data, error } = await ctx.supabase
    .from("leads")
    .insert({
      organization_id: ctx.organizationId,
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
      source: source || null,
      notes: notes || null,
      created_by: ctx.userId,
    })
    .select("lead_id")
    .single<{ lead_id: string }>();

  if (error) {
    console.error("createLead: insert failed", error.message);
    return { ok: false, error: "Could not create the lead. Please try again." };
  }

  return { ok: true, error: null, leadId: data.lead_id };
}

export async function updateLeadStatus(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireStaffContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const leadId = String(formData.get("leadId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!isLeadStatus(status)) {
    return { ok: false, error: "Invalid status." };
  }
  if (status === "converted") {
    return {
      ok: false,
      error: "Conversion requires a linked student and is not available yet.",
    };
  }

  const result = await requireLead(ctx, leadId);
  if ("error" in result) {
    return { ok: false, error: result.error };
  }
  const { lead } = result;

  if (lead.status === status) {
    return { ok: true, error: null };
  }

  const { error: updateError } = await ctx.supabase
    .from("leads")
    .update({ status })
    .eq("lead_id", leadId)
    .is("deleted_at", null);

  if (updateError) {
    console.error("updateLeadStatus: update failed", leadId, updateError.message);
    return { ok: false, error: "Could not update the status. Please try again." };
  }

  const { error: activityError } = await ctx.supabase
    .from("lead_activities")
    .insert({
      organization_id: ctx.organizationId,
      lead_id: leadId,
      performed_by: ctx.userId,
      activity_type: "status_change",
      notes: `Status changed to ${status}`,
      metadata: { from: lead.status, to: status },
    });

  if (activityError) {
    console.error(
      "updateLeadStatus: activity insert failed",
      leadId,
      activityError.message
    );
  }

  return { ok: true, error: null };
}

export async function assignLead(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireStaffContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const leadId = String(formData.get("leadId") ?? "").trim();
  const assignedTo = String(formData.get("assignedTo") ?? "").trim();

  const result = await requireLead(ctx, leadId);
  if ("error" in result) {
    return { ok: false, error: result.error };
  }
  const { lead } = result;

  let newAssignee: string | null = null;
  let assigneeName: string | null = null;
  if (assignedTo) {
    const assigneeResult = await requireOrgAssignee(ctx, assignedTo);
    if ("error" in assigneeResult) {
      return { ok: false, error: assigneeResult.error };
    }
    newAssignee = assignedTo;
    assigneeName = assigneeResult.member.full_name;
  }

  if (lead.assigned_to === newAssignee) {
    return { ok: true, error: null };
  }

  const { error: updateError } = await ctx.supabase
    .from("leads")
    .update({ assigned_to: newAssignee })
    .eq("lead_id", leadId)
    .is("deleted_at", null);

  if (updateError) {
    console.error("assignLead: update failed", leadId, updateError.message);
    return { ok: false, error: "Could not update the assignment. Please try again." };
  }

  const { error: activityError } = await ctx.supabase
    .from("lead_activities")
    .insert({
      organization_id: ctx.organizationId,
      lead_id: leadId,
      performed_by: ctx.userId,
      activity_type: "assignment",
      notes: assigneeName
        ? `Assigned to ${assigneeName}`
        : "Assignment cleared",
      metadata: { from: lead.assigned_to, to: newAssignee },
    });

  if (activityError) {
    console.error("assignLead: activity insert failed", leadId, activityError.message);
  }

  return { ok: true, error: null };
}

export async function createFollowup(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireStaffContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const leadId = String(formData.get("leadId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const priority = String(formData.get("priority") ?? "").trim();
  const dueAt = String(formData.get("dueAt") ?? "").trim();
  const assignedTo = String(formData.get("assignedTo") ?? "").trim();

  if (!title) {
    return { ok: false, error: "Title is required." };
  }
  if (!isFollowupPriority(priority)) {
    return { ok: false, error: "Invalid priority." };
  }
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) {
    return { ok: false, error: "A valid due date is required." };
  }

  const result = await requireLead(ctx, leadId);
  if ("error" in result) {
    return { ok: false, error: result.error };
  }

  let assignee: string | null = null;
  if (assignedTo) {
    const assigneeResult = await requireOrgAssignee(ctx, assignedTo);
    if ("error" in assigneeResult) {
      return { ok: false, error: assigneeResult.error };
    }
    assignee = assignedTo;
  }

  const { error } = await ctx.supabase.from("followups").insert({
    organization_id: ctx.organizationId,
    lead_id: leadId,
    title,
    notes: notes || null,
    due_at: due.toISOString(),
    priority: priority as FollowupPriority,
    assigned_to: assignee,
    created_by: ctx.userId,
  });

  if (error) {
    console.error("createFollowup: insert failed", error.message);
    return { ok: false, error: "Could not create the follow-up. Please try again." };
  }

  return { ok: true, error: null };
}

export async function completeFollowup(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireStaffContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const followupId = String(formData.get("followupId") ?? "").trim();
  if (!followupId) {
    return { ok: false, error: "Missing follow-up." };
  }

  const { data: followup, error } = await ctx.supabase
    .from("followups")
    .select("followup_id, status")
    .eq("followup_id", followupId)
    .maybeSingle<Pick<Followup, "followup_id" | "status">>();

  if (error || !followup) {
    console.error("completeFollowup: follow-up not found", followupId, error?.message);
    return { ok: false, error: "Follow-up not found." };
  }
  if (followup.status === "completed") {
    return { ok: true, error: null };
  }

  const { error: updateError } = await ctx.supabase
    .from("followups")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: ctx.userId,
    })
    .eq("followup_id", followupId);

  if (updateError) {
    console.error("completeFollowup: update failed", followupId, updateError.message);
    return { ok: false, error: "Could not complete the follow-up. Please try again." };
  }

  return { ok: true, error: null };
}

export async function cancelFollowup(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireStaffContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const followupId = String(formData.get("followupId") ?? "").trim();
  if (!followupId) {
    return { ok: false, error: "Missing follow-up." };
  }

  const { data: followup, error } = await ctx.supabase
    .from("followups")
    .select("followup_id, status")
    .eq("followup_id", followupId)
    .maybeSingle<Pick<Followup, "followup_id" | "status">>();

  if (error || !followup) {
    console.error("cancelFollowup: follow-up not found", followupId, error?.message);
    return { ok: false, error: "Follow-up not found." };
  }
  if (followup.status !== "pending") {
    return { ok: true, error: null };
  }

  const { error: updateError } = await ctx.supabase
    .from("followups")
    .update({ status: "cancelled" })
    .eq("followup_id", followupId);

  if (updateError) {
    console.error("cancelFollowup: update failed", followupId, updateError.message);
    return { ok: false, error: "Could not cancel the follow-up. Please try again." };
  }

  return { ok: true, error: null };
}

type ConvertibleLead = {
  lead_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: string;
  student_id: string | null;
};

export async function convertLead(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState & { studentId?: string }> {
  const ctx = await requireStaffContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const leadId = String(formData.get("leadId") ?? "").trim();
  if (!leadId) {
    return { ok: false, error: "Missing lead." };
  }

  const { data: lead, error } = await ctx.supabase
    .from("leads")
    .select(
      "lead_id, first_name, last_name, email, phone, notes, status, student_id"
    )
    .eq("lead_id", leadId)
    .is("deleted_at", null)
    .maybeSingle<ConvertibleLead>();

  if (error || !lead) {
    console.error("convertLead: lead not found", leadId, error?.message);
    return { ok: false, error: "Lead not found." };
  }

  if (lead.student_id) {
    return { ok: true, error: null, studentId: lead.student_id };
  }

  const { data: student, error: studentError } = await ctx.supabase
    .from("students")
    .insert({
      organization_id: ctx.organizationId,
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: lead.phone,
      notes: lead.notes,
      created_by: ctx.userId,
    })
    .select("student_id")
    .single<{ student_id: string }>();

  if (studentError) {
    console.error(
      "convertLead: student insert failed",
      leadId,
      studentError.message
    );
    return { ok: false, error: "Could not convert the lead. Please try again." };
  }

  const { data: recheck } = await ctx.supabase
    .from("leads")
    .select("student_id")
    .eq("lead_id", leadId)
    .maybeSingle<{ student_id: string | null }>();

  if (recheck?.student_id) {
    const { error: cleanupError } = await ctx.supabase
      .from("students")
      .delete()
      .eq("student_id", student.student_id);
    if (cleanupError) {
      console.error(
        "convertLead: orphan cleanup failed",
        student.student_id,
        cleanupError.message
      );
    }
    return { ok: true, error: null, studentId: recheck.student_id };
  }

  const { data: updated, error: updateError } = await ctx.supabase
    .from("leads")
    .update({
      student_id: student.student_id,
      converted_at: new Date().toISOString(),
      converted_by: ctx.userId,
      status: "converted",
    })
    .eq("lead_id", leadId)
    .is("deleted_at", null)
    .select("lead_id")
    .maybeSingle<{ lead_id: string }>();

  if (updateError || !updated) {
    console.error("convertLead: lead update failed", leadId, updateError?.message);
    const { error: cleanupError } = await ctx.supabase
      .from("students")
      .delete()
      .eq("student_id", student.student_id);
    if (cleanupError) {
      console.error(
        "convertLead: orphan cleanup failed",
        student.student_id,
        cleanupError.message
      );
    }
    return { ok: false, error: "Could not convert the lead. Please try again." };
  }

  const { error: activityError } = await ctx.supabase
    .from("lead_activities")
    .insert({
      organization_id: ctx.organizationId,
      lead_id: leadId,
      performed_by: ctx.userId,
      activity_type: "converted",
      notes: "Lead converted to student",
      metadata: {
        from: lead.status,
        to: "converted",
        student_id: student.student_id,
        converted_by: ctx.userId,
      },
    });

  if (activityError) {
    console.error(
      "convertLead: activity insert failed",
      leadId,
      activityError.message
    );
  }

  return { ok: true, error: null, studentId: student.student_id };
}