"use client";

import LogoutButton from "@/app/(protected)/dashboard/logout-button";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-[56px] w-full items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-background)]/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-background)]/60 max-lg:hidden">
      <div className="flex flex-1 items-center gap-4">
        {/* Placeholder for future search or breadcrumbs */}
      </div>
      <div className="flex items-center gap-4">
        <LogoutButton />
      </div>
    </header>
  );
}
