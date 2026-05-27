"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const dashboardTabs = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Trips", href: "/dashboard/trips" },
  { label: "Imports", href: "/dashboard/imports" },
  { label: "Admin", href: "/dashboard/admin" }
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard" className="flex flex-wrap gap-2">
      {dashboardTabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              active
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            ].join(" ")}
            href={tab.href}
            key={tab.href}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
