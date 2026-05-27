"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Overview", href: "" },
  { label: "Timeline", href: "/timeline" },
  { label: "Map", href: "/map" },
  { label: "Budget", href: "/budget" },
  { label: "Sharing", href: "/sharing" }
] as const;

export function TripTabs({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/trips/${tripId}`;

  return (
    <nav aria-label="Trip tabs" className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const href = `${base}${tab.href}`;
        const active = pathname === href || (tab.href === "" && pathname === base);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              active
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            ].join(" ")}
            href={href}
            key={tab.label}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
