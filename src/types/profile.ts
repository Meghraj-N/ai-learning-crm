import type { UserRole } from "@/lib/roles";

export type Profile = {
  user_id: string;
  organization_id: string | null;
  email: string;
  full_name: string;
  role: UserRole | null;
  is_active: boolean;
  created_at: string;
};