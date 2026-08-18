"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignUpState = {
  status: "idle" | "error" | "success";
  error: string | null;
};

export async function signUp(
  _prevState: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!email || !password || !fullName) {
    return { status: "error", error: "Please fill out all required fields." };
  }

  if (password !== confirmPassword) {
    return { status: "error", error: "Passwords do not match." };
  }

  if (password.length < 8) {
    return { status: "error", error: "Password must be at least 8 characters long." };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    console.error("Signup failed:", error.code, error.message);
    if (error.message.includes("already registered")) {
      return { status: "error", error: "An account with this email already exists. Try signing in instead." };
    }
    if (error.message.includes("weak")) {
      return { status: "error", error: "Choose a stronger password." };
    }
    return { status: "error", error: "Unable to create account right now. Please try again." };
  }

  return { status: "success", error: null };
}
