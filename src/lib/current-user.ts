import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/roles";

export type CurrentProfile = {
  user_id: string;
  organization_id: string | null;
  role: UserRole | null;
  is_active: boolean;
  full_name: string;
  email: string;
};

export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, organization_id, role, is_active, full_name, email")
    .eq("user_id", user.id)
    .maybeSingle<CurrentProfile>();

  return profile ?? null;
});