"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  cancelFollowup,
  completeFollowup,
  type ActionState,
} from "../actions";
import { Button } from "@/components/ui/button";

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
      <form action={completeAction} className="inline-flex mr-2">
        <input type="hidden" name="followupId" value={followupId} />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={pending}
          className="text-[var(--color-success)] border-[var(--color-success)]/20 hover:bg-[var(--color-success)]/10 hover:text-[var(--color-success)]"
        >
          {completePending ? "Saving…" : "Complete"}
        </Button>
      </form>
      <form action={cancelAction} className="inline-flex">
        <input type="hidden" name="followupId" value={followupId} />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={pending}
        >
          {cancelPending ? "Saving…" : "Cancel"}
        </Button>
      </form>
      {error && <span className="text-xs text-[var(--color-danger)] block mt-2">{error}</span>}
    </>
  );
}