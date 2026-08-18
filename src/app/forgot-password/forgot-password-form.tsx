"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPassword } from "./actions";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(forgotPassword, {
    status: "idle",
    error: null,
  });

  if (state.status === "success") {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12 min-h-screen bg-[var(--color-background)]">
        <Card className="w-full max-w-[400px] border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl text-center pb-8 pt-8 px-4">
          <CardTitle className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)] mb-2">
            Check your email
          </CardTitle>
          <CardDescription className="text-[14px] text-[var(--color-text-secondary)] mb-8">
            If an account exists for this email, you&apos;ll receive a password reset link.
          </CardDescription>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--color-primary)] px-8 text-sm font-medium text-white shadow transition-colors hover:bg-[var(--color-primary)]/90"
          >
            Back to sign in
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
            Forgot your password?
          </CardTitle>
          <CardDescription className="text-[14px] text-[var(--color-text-secondary)]">
            Enter your email and we&apos;ll send you a reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-[13px] font-medium text-[var(--color-text-primary)]"
              >
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
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
              {isPending ? "Sending reset link..." : "Send reset link"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 pb-8 border-t border-[var(--color-border)] pt-6 text-center">
          <Link
            href="/login"
            className="text-[13px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
