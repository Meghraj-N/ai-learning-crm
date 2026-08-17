"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  cancelFollowup,
  completeFollowup,
  type ActionState,
} from "../actions";

export default function FollowupActions({
  followupId,
}: {
  followupId: string;
}) {
  const router = useRouter();
  const [completeState, completeAction, completePending] = useActionState<
    ActionState,
    FormData
  >(completeFollowup, { ok: false, error: null });
  const [cancelState, cancelAction, cancelPending] = useActionState<
    ActionState,
    FormData
  >(cancelFollowup, { ok: false, error: null });

  useEffect(() => {
    if (completeState.ok || cancelState.ok) {
      router.refresh();
    }
  }, [completeState, cancelState, router]);

  const pending = completePending || cancelPending;
  const error = completeState.error ?? cancelState.error;

  return (
    <>
      <form action={completeAction} className="inline-flex">
        <input type="hidden" name="followupId" value={followupId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {completePending ? "Saving…" : "Complete"}
        </button>
      </form>
      <form action={cancelAction} className="inline-flex">
        <input type="hidden" name="followupId" value={followupId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cancelPending ? "Saving…" : "Cancel"}
        </button>
      </form>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </>
  );
}