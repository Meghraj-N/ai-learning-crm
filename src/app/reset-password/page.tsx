import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ResetPasswordForm from "./reset-password-form";

export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // For resetting password, the user might be authenticated via the recovery link session.
  // We do not redirect them away if they are authenticated; instead we let them reset their password.
  // If they are not authenticated, they shouldn't be here (recovery link establishes session).
  if (!user) {
    redirect("/login");
  }

  return <ResetPasswordForm />;
}
