"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

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

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!host) {
    console.error("Forgot password failed: request host is unavailable");
    return { status: "error", error: "Unable to start password reset. Please try again." };
  }

  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  const origin = `${protocol}://${host}`;
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
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
