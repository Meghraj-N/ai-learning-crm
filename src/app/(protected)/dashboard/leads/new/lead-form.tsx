"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createLead, type ActionState } from "../actions";

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
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="firstName"
            className="block text-sm font-medium text-[#F4F4F5]"
          >
            First name <span className="text-red-500">*</span>
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-[#272B33] bg-[#181B21] px-3 py-2 text-sm text-[#F4F4F5] shadow-sm outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] disabled:opacity-50 placeholder:text-[#A1A1AA]"
          />
        </div>
        <div>
          <label
            htmlFor="lastName"
            className="block text-sm font-medium text-[#F4F4F5]"
          >
            Last name <span className="text-red-500">*</span>
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-[#272B33] bg-[#181B21] px-3 py-2 text-sm text-[#F4F4F5] shadow-sm outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] disabled:opacity-50 placeholder:text-[#A1A1AA]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-[#F4F4F5]"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-[#272B33] bg-[#181B21] px-3 py-2 text-sm text-[#F4F4F5] shadow-sm outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] disabled:opacity-50 placeholder:text-[#A1A1AA]"
          />
        </div>
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-[#F4F4F5]"
          >
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-[#272B33] bg-[#181B21] px-3 py-2 text-sm text-[#F4F4F5] shadow-sm outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] disabled:opacity-50 placeholder:text-[#A1A1AA]"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="source"
          className="block text-sm font-medium text-[#F4F4F5]"
        >
          Source
        </label>
        <input
          id="source"
          name="source"
          type="text"
          placeholder="e.g. Website, Referral, Walk-in"
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-[#272B33] bg-[#181B21] px-3 py-2 text-sm text-[#F4F4F5] shadow-sm outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] disabled:opacity-50 placeholder:text-[#A1A1AA]"
        />
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-[#F4F4F5]"
        >
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-[#272B33] bg-[#181B21] px-3 py-2 text-sm text-[#F4F4F5] shadow-sm outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] disabled:opacity-50 placeholder:text-[#A1A1AA]"
        />
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-500"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-[#6366F1] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:ring-offset-2 focus:ring-offset-[#111318] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create lead"}
        </button>
      </div>
    </form>
  );
}