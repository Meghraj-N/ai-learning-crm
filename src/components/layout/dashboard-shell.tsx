import { Sidebar, type NavigationGroup } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import LogoutButton from "@/app/(protected)/dashboard/logout-button";

export function DashboardShell({
  children,
  navigation,
}: {
  children: React.ReactNode;
  navigation: NavigationGroup[];
}) {
  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Sidebar navigation={navigation} />
      <div className="lg:pl-[240px] flex flex-col min-h-screen">
        <TopBar />
        {/* Mobile topbar replacement that only holds logout */}
        <div className="lg:hidden flex h-[56px] w-full items-center justify-end px-4 border-b border-[var(--color-border)] bg-[var(--color-background)] pt-14">
           <LogoutButton />
        </div>

        <main className="flex-1 p-6 lg:p-8 max-w-[1440px] mx-auto w-full pt-20 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
