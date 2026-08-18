"use client";

import { useFormStatus } from "react-dom";
import { signOut } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Signing out..." : "Logout"}
    </button>
  );
}

export default function LogoutButton() {
  return (
    <form action={signOut}>
      <SubmitButton />
    </form>
  );
}