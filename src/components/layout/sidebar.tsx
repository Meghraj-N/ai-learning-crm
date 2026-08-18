"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  LineChart,
  Settings,
  Sparkles,
  Menu,
} from "lucide-react";
import { useState } from "react";

// Map string icon names to Lucide components to allow passing from Server Components
const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  LineChart,
  Settings,
  Sparkles,
};

export type NavigationItem = {
  name: string;
  href: string;
  icon: string;
};

export type NavigationGroup = {
  title: string;
  items: NavigationItem[];
};

export function Sidebar({ navigation }: { navigation: NavigationGroup[] }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Toggle */}
      <div className="lg:hidden fixed top-0 left-0 w-full h-[56px] bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center px-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="ml-4 font-semibold text-[var(--color-text-primary)]">AI Learning & CRM</span>
      </div>

      {/* Sidebar Content */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[240px] transform bg-[var(--color-surface)] border-r border-[var(--color-border)] transition-transform duration-200 ease-in-out lg:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-[56px] items-center px-6 border-b border-[var(--color-border)]">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)]">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-[var(--color-text-primary)] tracking-tight">AI Learning & CRM</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-8">
          {navigation.map((group) => (
            <div key={group.title}>
              <h3 className="mb-3 px-2 text-xs font-semibold text-[var(--color-text-muted)] tracking-wider">
                {group.title}
              </h3>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  const Icon = iconMap[item.icon] || Sparkles;
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          "group flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-[13px] font-medium transition-colors",
                          isActive
                            ? "bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)]"
                            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)]"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            isActive ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]"
                          )}
                        />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
