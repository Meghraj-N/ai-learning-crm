import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";

export type AdminContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  organizationId: string;
};

export async function requireAdminContext(): Promise<AdminContext | null> {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile();

  if (
    !profile ||
    !profile.is_active ||
    !profile.organization_id ||
    profile.role !== "admin"
  ) {
    return null;
  }

  return {
    supabase,
    userId: profile.user_id,
    organizationId: profile.organization_id,
  };
}