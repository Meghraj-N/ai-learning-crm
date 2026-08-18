"use client";

import LogoutButton from "@/app/(protected)/dashboard/logout-button";
import type { CurrentProfile } from "@/lib/current-user";

export function TopBar({ user }: { user?: CurrentProfile | null }) {
  return (
    <header className="sticky top-0 z-30 flex h-[60px] w-full items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-background)]/80 px-8 backdrop-blur-md max-lg:hidden">
      <div className="flex flex-1 items-center gap-4">
        {/* Placeholder for future search or breadcrumbs */}
      </div>
      <div className="flex items-center gap-6">
        {user && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-elevated)] border border-[var(--color-border-active)] text-sm font-medium">
              {user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-none text-[var(--color-text-primary)]">{user.email}</span>
              <span className="text-xs text-[var(--color-text-muted)] mt-1 capitalize">{user.role || "User"}</span>
            </div>
          </div>
        )}
        <div className="h-6 w-px bg-[var(--color-border)]"></div>
        <LogoutButton />
      </div>
    </header>
  );
}
