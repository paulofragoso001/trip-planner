"use client";

import { ChevronDown } from "lucide-react";
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

const mobileTabs = tabs.slice(0, 4);
const secondaryTabs = tabs.slice(4);

export function TripTabs({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/trips/${tripId}`;

  return (
    <div className="grid gap-2">
      <nav
        aria-label="Trip sections"
        className="flex min-w-0 gap-1 overflow-visible rounded-full border border-white/10 bg-white/10 p-1 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur-2xl lg:hidden"
        data-testid="trip-section-menu"
      >
        {mobileTabs.map((tab) => {
          const href = `${base}${tab.href}`;
          const active =
            tab.href === ""
              ? pathname === base
              : pathname === href;

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={[
                "inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-2 text-xs font-black transition",
                active
                  ? "bg-white text-slate-950 shadow-md"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              ].join(" ")}
              href={href}
              key={tab.label}
            >
              {tab.label}
            </Link>
          );
        })}
        <details className="group relative flex-1">
          <summary className="inline-flex min-h-11 w-full cursor-pointer list-none items-center justify-center gap-1 rounded-full px-2 text-xs font-black text-slate-300 transition hover:bg-white/10 hover:text-white">
            More
            <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 grid min-w-44 gap-1 rounded-3xl border border-white/10 bg-slate-950/96 p-2 text-slate-100 shadow-2xl backdrop-blur-2xl">
            {secondaryTabs.map((tab) => {
              const href = `${base}${tab.href}`;
              const active = pathname === href;

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={[
                    "inline-flex min-h-11 items-center rounded-2xl px-3 text-sm font-black transition",
                    active
                      ? "bg-white text-slate-950"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  ].join(" ")}
                  href={href}
                  key={tab.label}
                >
                  {tab.label}
                </Link>
              );
            })}
            <Link
              className="inline-flex min-h-11 items-center rounded-2xl px-3 text-sm font-black text-slate-300 hover:bg-white/10 hover:text-white"
              href="/dashboard/account"
            >
              Settings
            </Link>
          </div>
        </details>
      </nav>

      <nav
        aria-label="Trip tabs"
        className="hidden gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/10 p-1 shadow-[0_18px_50px_rgba(2,6,23,0.18)] backdrop-blur-2xl sm:flex-wrap sm:overflow-visible lg:flex lg:p-1.5"
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
                  ? "bg-white text-slate-950 shadow-md"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              ].join(" ")}
              href={href}
              key={tab.label}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
