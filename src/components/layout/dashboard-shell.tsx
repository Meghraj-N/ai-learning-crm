import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import LogoutButton from "@/app/(protected)/dashboard/logout-button";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09090B]">
      <Sidebar />
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <TopBar />
        {/* Mobile topbar replacement that only holds logout */}
        <div className="lg:hidden flex h-16 w-full items-center justify-end px-4 border-b border-[#272B33] bg-[#09090B] pt-16">
           <LogoutButton />
        </div>

        <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full pt-20 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
