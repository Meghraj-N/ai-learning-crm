"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { convertLead, type ActionState } from "../actions";

export default function ConvertButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState<
    ActionState & { studentId?: string },
    FormData
  >(convertLead, { ok: false, error: null });

  useEffect(() => {
    if (state.ok && state.studentId) {
      router.push(`/dashboard/students/${state.studentId}`);
    }
  }, [state, router]);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      >
        Convert to Student
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="leadId" value={leadId} />
      <p className="text-sm text-zinc-600">
        Convert this lead to a student? Contact details are copied into the
        student record and the lead is marked as converted.
      </p>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Converting…" : "Confirm conversion"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={isPending}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Cancel
      </button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}