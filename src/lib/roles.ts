export const USER_ROLES = [
  "admin",
  "sales",
  "counselor",
  "instructor",
  "student",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}