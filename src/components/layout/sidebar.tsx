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

const navigation = [
  {
    title: "WORKSPACE",
    items: [
      { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { name: "Leads", href: "/dashboard/leads", icon: Users },
      { name: "Students", href: "/dashboard/students", icon: GraduationCap },
      { name: "Courses", href: "/dashboard/courses", icon: BookOpen },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      { name: "Analytics", href: "/dashboard/analytics", icon: LineChart },
      { name: "AI Assistant", href: "/dashboard/ai", icon: Sparkles },
    ],
  },
  {
    title: "ADMIN",
    items: [
      { name: "Users", href: "/dashboard/users", icon: Users },
      { name: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Toggle */}
      <div className="lg:hidden fixed top-0 left-0 w-full h-16 bg-[#09090B] border-b border-[#272B33] flex items-center px-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="ml-4 font-semibold text-[#F4F4F5]">AI Learning & CRM</span>
      </div>

      {/* Sidebar Content */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform bg-[#09090B] border-r border-[#272B33] transition-transform duration-200 ease-in-out lg:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center px-6 border-b border-[#272B33]">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6366F1]">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-[#F4F4F5] tracking-tight">AI Learning & CRM</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-8">
          {navigation.map((group) => (
            <div key={group.title}>
              <h3 className="mb-3 px-2 text-xs font-semibold text-[#71717A] tracking-wider">
                {group.title}
              </h3>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          "group flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-[#181B21] text-[#F4F4F5]"
                            : "text-[#A1A1AA] hover:bg-[#111318] hover:text-[#F4F4F5]"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-4 w-4",
                            isActive ? "text-[#6366F1]" : "text-[#71717A] group-hover:text-[#A1A1AA]"
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
