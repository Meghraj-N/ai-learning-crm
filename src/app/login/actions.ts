"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = {
  status: "idle" | "error" | "success";
  error: string | null;
};

export async function signIn(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { status: "error", error: "Email and password are required." };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Login failed:", error.code, error.message);
    if (error.message.includes("Invalid login credentials")) {
      return { status: "error", error: "Invalid email or password." };
    }
    if (error.message.includes("Email not confirmed")) {
      return { status: "error", error: "Please confirm your email address before signing in." };
    }
    return { status: "error", error: "Unable to sign in right now. Please try again." };
  }

  return { status: "success", error: null };
}