"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Home", href: "/dashboard" },
  { label: "My Trips", href: "/dashboard/trips" },
  { label: "Plan with AI", href: "/dashboard/imports" }
] as const;

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        Navigation
      </p>
      <nav aria-label="Dashboard sidebar" className="mt-4 grid gap-2">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={[
                "rounded-2xl px-4 py-3 text-sm font-semibold transition",
                active
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              ].join(" ")}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
