"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const dashboardTabs = [
  { label: "Home", href: "/dashboard" },
  { label: "My Trips", href: "/dashboard/trips" },
  { label: "Plan with AI", href: "/dashboard/imports" }
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
