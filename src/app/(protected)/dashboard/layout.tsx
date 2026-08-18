import { getCurrentProfile } from "@/lib/current-user";
import { isCrmRole, canViewStudents } from "@/lib/crm";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { NavigationGroup, NavigationItem } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  const showLeads = isCrmRole(profile?.role ?? null);
  const showStudents = canViewStudents(profile?.role ?? null);
  const isAdmin = profile?.role === "admin";

  const workspaceItems: NavigationItem[] = [
    { name: "Overview", href: "/dashboard", icon: "LayoutDashboard" },
  ];
  if (showLeads) {
    workspaceItems.push({ name: "Leads", href: "/dashboard/leads", icon: "Users" });
  }
  if (showStudents) {
    workspaceItems.push({ name: "Students", href: "/dashboard/students", icon: "GraduationCap" });
  }
  workspaceItems.push({ name: "Courses", href: "/dashboard/courses", icon: "BookOpen" });

  const intelligenceItems: NavigationItem[] = [
    { name: "Analytics", href: "/dashboard/analytics", icon: "LineChart" },
  ];

  const adminItems: NavigationItem[] = [];
  if (isAdmin) {
    adminItems.push({ name: "Users", href: "/dashboard/users", icon: "Users" });
    adminItems.push({ name: "Settings", href: "/dashboard/settings", icon: "Settings" });
  }

  const navigation: NavigationGroup[] = [
    { title: "WORKSPACE", items: workspaceItems },
    { title: "INTELLIGENCE", items: intelligenceItems },
  ];

  if (adminItems.length > 0) {
    navigation.push({ title: "ADMIN", items: adminItems });
  }

  return <DashboardShell navigation={navigation}>{children}</DashboardShell>;
}