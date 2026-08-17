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
        className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-900 shadow-sm outline-none focus:border-zinc-500 disabled:opacity-50"
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
        className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Provisioning…" : "Provision"}
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}