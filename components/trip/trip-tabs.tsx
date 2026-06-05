"use client";

import { ChevronDown, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
  const [open, setOpen] = useState(false);
  const base = `/dashboard/trips/${tripId}`;
  const activeTab =
    tabs.find((tab) => {
      const href = `${base}${tab.href}`;
      return tab.href === "" ? pathname === base : pathname === href;
    }) || tabs[0];

  return (
    <div className="grid gap-2">
      <div className="relative lg:hidden" data-testid="trip-section-menu">
        <button
          aria-expanded={open}
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <Menu className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{activeTab.label}</span>
          </span>
          <ChevronDown className={open ? "h-4 w-4 rotate-180 transition" : "h-4 w-4 transition"} aria-hidden="true" />
        </button>
        {open ? (
          <nav
            aria-label="Trip sections"
            className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 grid gap-1 rounded-3xl border border-slate-200 bg-white p-2 shadow-2xl"
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
                    "inline-flex min-h-11 items-center rounded-2xl px-3 text-sm font-black transition",
                    active
                      ? "bg-slate-950 text-white"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                  ].join(" ")}
                  href={href}
                  key={tab.label}
                  onClick={() => setOpen(false)}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>

      <nav
        aria-label="Trip tabs"
        className="hidden gap-1 overflow-x-auto rounded-full bg-white/70 p-1 shadow-sm ring-1 ring-slate-200/80 backdrop-blur sm:flex-wrap sm:overflow-visible lg:flex lg:bg-white/86 lg:p-1.5"
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
    </div>
  );
}
