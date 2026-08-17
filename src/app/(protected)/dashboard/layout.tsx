import Link from "next/link";
import { getCurrentProfile } from "@/lib/current-user";
import { isCrmRole, canViewStudents } from "@/lib/crm";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  const showLeads = isCrmRole(profile?.role ?? null);
  const showStudents = canViewStudents(profile?.role ?? null);
  const isAdmin = profile?.role === "admin";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link
            href="/dashboard"
            className="text-sm font-semibold tracking-tight text-zinc-900"
          >
            AI Learning &amp; CRM Hub
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm text-zinc-600 transition-colors hover:text-zinc-900"
            >
              Dashboard
            </Link>
            {showLeads && (
              <Link
                href="/dashboard/leads"
                className="text-sm text-zinc-600 transition-colors hover:text-zinc-900"
              >
                Leads
              </Link>
            )}
            {showStudents && (
              <Link
                href="/dashboard/students"
                className="text-sm text-zinc-600 transition-colors hover:text-zinc-900"
              >
                Students
              </Link>
            )}
            <Link
              href="/dashboard/courses"
              className="text-sm text-zinc-600 transition-colors hover:text-zinc-900"
            >
              Courses
            </Link>
            {isAdmin && (
              <Link
                href="/dashboard/users"
                className="text-sm text-zinc-600 transition-colors hover:text-zinc-900"
              >
                Users
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}