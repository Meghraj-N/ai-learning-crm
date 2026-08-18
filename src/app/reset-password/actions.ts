"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ResetPasswordState = {
  status: "idle" | "error" | "success";
  error: string | null;
};

export async function updatePassword(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password || !confirmPassword) {
    return { status: "error", error: "Please fill out all fields." };
  }

  if (password !== confirmPassword) {
    return { status: "error", error: "Passwords do not match." };
  }

  if (password.length < 8) {
    return { status: "error", error: "Password must be at least 8 characters long." };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    console.error("Password reset failed:", error.code, error.message);
    if (error.message.includes("weak")) {
      return { status: "error", error: "Choose a stronger password." };
    }
    return { status: "error", error: "Unable to update password. Your link may have expired." };
  }

  return { status: "success", error: null };
}
