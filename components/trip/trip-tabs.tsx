"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Overview", href: "" },
  { label: "Itinerary", href: "/timeline" },
  { label: "Map", href: "/map" },
  { label: "Ideas", href: "/ideas" },
  { label: "Expenses", href: "/budget" },
  { label: "Documents", href: "/documents" },
  { label: "Share", href: "/sharing" }
] as const;

export function TripTabs({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/trips/${tripId}`;

  return (
    <nav
      aria-label="Trip tabs"
      className="flex gap-1 overflow-x-auto rounded-full bg-white/70 p-1 shadow-sm ring-1 ring-slate-200/80 backdrop-blur sm:flex-wrap sm:overflow-visible lg:bg-white/86 lg:p-1.5"
    >
      {tabs.map((tab) => {
        const href = `${base}${tab.href}`;
        const active =
          tab.href === ""
            ? pathname === base
            : pathname === href;

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={[
              "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-3 text-xs font-black transition sm:px-4 sm:text-sm",
              active
                ? "bg-slate-950 text-white shadow-md"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
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
