import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import type { UserRole } from "@/lib/roles";

const CRM_ROLES: readonly UserRole[] = ["admin", "sales", "counselor"];

const STUDENT_VIEW_ROLES: readonly UserRole[] = [
  "admin",
  "sales",
  "counselor",
  "instructor",
];

const COURSE_WRITE_ROLES: readonly UserRole[] = ["admin", "instructor"];

const ENROLLMENT_WRITE_ROLES: readonly UserRole[] = [
  "admin",
  "sales",
  "counselor",
];

function isRoleIn(
  role: UserRole | null,
  roles: readonly UserRole[]
): role is UserRole {
  return role !== null && (roles as readonly string[]).includes(role);
}

export function isCrmRole(role: UserRole | null): role is UserRole {
  return isRoleIn(role, CRM_ROLES);
}

export function canViewStudents(role: UserRole | null): boolean {
  return isRoleIn(role, STUDENT_VIEW_ROLES);
}

export function canViewCourses(role: UserRole | null): boolean {
  return role !== null;
}

export function canManageCourses(role: UserRole | null): boolean {
  return isRoleIn(role, COURSE_WRITE_ROLES);
}

export function canManageEnrollments(role: UserRole | null): boolean {
  return isRoleIn(role, ENROLLMENT_WRITE_ROLES);
}

export type StaffContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  organizationId: string;
  role: UserRole;
};

async function requireContextWithRoles(
  roles: readonly UserRole[]
): Promise<StaffContext | null> {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile();

  if (
    !profile ||
    !profile.is_active ||
    !profile.organization_id ||
    !isRoleIn(profile.role, roles)
  ) {
    return null;
  }

  return {
    supabase,
    userId: profile.user_id,
    organizationId: profile.organization_id,
    role: profile.role,
  };
}

export function requireStaffContext(): Promise<StaffContext | null> {
  return requireContextWithRoles(CRM_ROLES);
}

export function requireStudentViewContext(): Promise<StaffContext | null> {
  return requireContextWithRoles(STUDENT_VIEW_ROLES);
}

export function requireCourseWriteContext(): Promise<StaffContext | null> {
  return requireContextWithRoles(COURSE_WRITE_ROLES);
}

export function requireEnrollmentWriteContext(): Promise<StaffContext | null> {
  return requireContextWithRoles(ENROLLMENT_WRITE_ROLES);
}

export type StudentContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  organizationId: string;
  studentId: string;
};

export async function requireStudentContext(): Promise<StudentContext | null> {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile();

  if (
    !profile ||
    !profile.is_active ||
    !profile.organization_id ||
    profile.role !== "student"
  ) {
    return null;
  }

  const { data: student } = await supabase
    .from("students")
    .select("student_id, organization_id")
    .eq("profile_id", profile.user_id)
    .is("deleted_at", null)
    .returns<{ student_id: string; organization_id: string }[]>()
    .limit(1);

  const linked = student?.[0];
  if (!linked || linked.organization_id !== profile.organization_id) {
    return null;
  }

  return {
    supabase,
    userId: profile.user_id,
    organizationId: profile.organization_id,
    studentId: linked.student_id,
  };
}