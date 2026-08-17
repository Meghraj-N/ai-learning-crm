"use client";

import LogoutButton from "@/app/(protected)/dashboard/logout-button";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#272B33] bg-[#09090B]/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-[#09090B]/60 max-lg:hidden">
      <div className="flex flex-1 items-center gap-4">
        {/* Placeholder for future search or breadcrumbs */}
      </div>
      <div className="flex items-center gap-4">
        <LogoutButton />
      </div>
    </header>
  );
}
