"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { updatePassword } from "./actions";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

export default function ResetPasswordForm() {
  const [showPassword, setShowPassword] = useState(false);

  const [state, formAction, isPending] = useActionState(updatePassword, {
    status: "idle",
    error: null,
  });

  if (state.status === "success") {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12 min-h-screen bg-[var(--color-background)]">
        <Card className="w-full max-w-[400px] border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl text-center pb-8 pt-8 px-4">
          <CardTitle className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)] mb-2">
            Password updated
          </CardTitle>
          <CardDescription className="text-[14px] text-[var(--color-text-secondary)] mb-8">
            Your password has been successfully reset.
          </CardDescription>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--color-primary)] px-8 text-sm font-medium text-white shadow transition-colors hover:bg-[var(--color-primary)]/90"
          >
            Go to login
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12 min-h-screen bg-[var(--color-background)]">
      <Card className="w-full max-w-[400px] border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        <CardHeader className="space-y-3 text-center pb-8 pt-8">
          <CardTitle className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            Reset password
          </CardTitle>
          <CardDescription className="text-[14px] text-[var(--color-text-secondary)]">
            Create a new password for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-[13px] font-medium text-[var(--color-text-primary)]"
                >
                  New password
                </label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Enter new password"
                  required
                  disabled={isPending}
                  className="bg-transparent border-[var(--color-border)] text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] pr-10 shadow-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="confirmPassword"
                  className="block text-[13px] font-medium text-[var(--color-text-primary)]"
                >
                  Confirm new password
                </label>
              </div>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirm new password"
                required
                disabled={isPending}
                className="bg-transparent border-[var(--color-border)] text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] shadow-none"
              />
            </div>

            {state.error && (
              <p
                role="alert"
                className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]"
              >
                {state.error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isPending}
              className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white font-medium"
            >
              {isPending ? "Updating password..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
