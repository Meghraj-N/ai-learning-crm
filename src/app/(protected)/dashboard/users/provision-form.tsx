"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { provisionUser, type ActionState } from "./actions";
import { USER_ROLES } from "@/lib/roles";

export default function ProvisionForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    provisionUser,
    { ok: false, error: null }
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue=""
        required
        disabled={isPending}
        className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
      >
        <option value="" disabled>
          Role…
        </option>
        {USER_ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[var(--color-primary)]/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Provisioning…" : "Provision"}
      </button>
      {state.error && <span className="text-xs text-[var(--color-destructive)]">{state.error}</span>}
    </form>
  );
}