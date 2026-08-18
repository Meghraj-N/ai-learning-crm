"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ForgotPasswordState = {
  status: "idle" | "error" | "success";
  error: string | null;
};

export async function forgotPassword(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return { status: "error", error: "Email is required." };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/reset-password`,
  });

  if (error) {
    console.error("Forgot password failed:", error.code, error.message);
    // Don't expose whether the email exists. Show generic success or a generic failure if it's a rate limit.
    if (error.message.includes("rate limit")) {
      return { status: "error", error: "Too many requests. Please try again later." };
    }
  }

  return { status: "success", error: null };
}
