"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createLead, type ActionState } from "../actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LeadForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    ActionState & { leadId?: string },
    FormData
  >(createLead, { ok: false, error: null });

  useEffect(() => {
    if (state.ok && state.leadId) {
      router.push(`/dashboard/leads/${state.leadId}`);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="firstName"
            className="block text-[13px] font-medium text-[var(--color-text-primary)]"
          >
            First name <span className="text-[var(--color-danger)]">*</span>
          </label>
          <Input
            id="firstName"
            name="firstName"
            type="text"
            required
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="lastName"
            className="block text-[13px] font-medium text-[var(--color-text-primary)]"
          >
            Last name <span className="text-[var(--color-danger)]">*</span>
          </label>
          <Input
            id="lastName"
            name="lastName"
            type="text"
            required
            disabled={isPending}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            inputMode="email"
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="phone"
            className="block text-[13px] font-medium text-[var(--color-text-primary)]"
          >
            Phone
          </label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            disabled={isPending}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="source"
          className="block text-[13px] font-medium text-[var(--color-text-primary)]"
        >
          Source
        </label>
        <Input
          id="source"
          name="source"
          type="text"
          placeholder="e.g. Website, Referral, Walk-in"
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="notes"
          className="block text-[13px] font-medium text-[var(--color-text-primary)]"
        >
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          disabled={isPending}
          className="flex w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
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

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Creating…" : "Create lead"}
        </Button>
      </div>
    </form>
  );
}