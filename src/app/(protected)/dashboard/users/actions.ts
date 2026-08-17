"use server";

import { requireAdminContext } from "@/lib/admin";
import { isUserRole } from "@/lib/roles";
import type { UserRole } from "@/lib/roles";

export type ActionState = {
  ok: boolean;
  error: string | null;
};

type TargetUser = {
  user_id: string;
  organization_id: string | null;
  role: UserRole | null;
  is_active: boolean;
};

async function requireTarget(
  ctx: NonNullable<Awaited<ReturnType<typeof requireAdminContext>>>,
  targetUserId: string
): Promise<{ target: TargetUser } | { error: string }> {
  if (!targetUserId) {
    return { error: "Missing user." };
  }
  if (targetUserId === ctx.userId) {
    return { error: "You cannot modify your own account." };
  }

  const { data: target, error } = await ctx.supabase
    .from("profiles")
    .select("user_id, organization_id, role, is_active")
    .eq("user_id", targetUserId)
    .maybeSingle<TargetUser>();

  if (error || !target) {
    console.error("User action: target not found", targetUserId, error?.message);
    return { error: "User not found." };
  }

  return { target };
}

export async function provisionUser(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAdminContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const targetUserId = String(formData.get("userId") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();

  if (!isUserRole(role)) {
    return { ok: false, error: "Invalid role." };
  }

  const result = await requireTarget(ctx, targetUserId);
  if ("error" in result) {
    return { ok: false, error: result.error };
  }
  const { target } = result;

  if (target.organization_id !== null) {
    return { ok: false, error: "User is already provisioned." };
  }

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ organization_id: ctx.organizationId, role, is_active: true })
    .eq("user_id", targetUserId);

  if (error) {
    console.error(
      "provisionUser: update failed",
      targetUserId,
      error.message
    );
    return { ok: false, error: "Provisioning failed. Please try again." };
  }

  return { ok: true, error: null };
}

export async function changeRole(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAdminContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const targetUserId = String(formData.get("userId") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();

  if (!isUserRole(role)) {
    return { ok: false, error: "Invalid role." };
  }

  const result = await requireTarget(ctx, targetUserId);
  if ("error" in result) {
    return { ok: false, error: result.error };
  }
  const { target } = result;

  if (target.organization_id === null) {
    return { ok: false, error: "User is not provisioned. Use Provision instead." };
  }
  if (target.role === "admin") {
    return { ok: false, error: "Admin accounts cannot be modified." };
  }

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ role })
    .eq("user_id", targetUserId);

  if (error) {
    console.error("changeRole: update failed", targetUserId, error.message);
    return { ok: false, error: "Role update failed. Please try again." };
  }

  return { ok: true, error: null };
}

export async function toggleActive(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAdminContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const targetUserId = String(formData.get("userId") ?? "").trim();
  const isActive = formData.get("isActive") === "true";

  const result = await requireTarget(ctx, targetUserId);
  if ("error" in result) {
    return { ok: false, error: result.error };
  }
  const { target } = result;

  if (target.organization_id === null) {
    return { ok: false, error: "User is not provisioned yet." };
  }
  if (target.role === "admin") {
    return { ok: false, error: "Admin accounts cannot be modified." };
  }
  if (target.is_active === isActive) {
    return { ok: true, error: null };
  }

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("user_id", targetUserId);

  if (error) {
    console.error("toggleActive: update failed", targetUserId, error.message);
    return { ok: false, error: "Status update failed. Please try again." };
  }

  return { ok: true, error: null };
}