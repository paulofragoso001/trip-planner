"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const tabs = [
  { label: "Overview", href: "" },
  { label: "Itinerary", href: "/timeline" },
  { label: "Map", href: "/map" },
  { label: "Ideas", href: "/ideas" },
  { label: "Expenses", href: "/budget" },
  { label: "Documents", href: "/documents" },
  { label: "Share", href: "/share" }
] as const;

const mobileTabs = tabs.slice(0, 4);
const secondaryTabs = tabs.slice(4);

export function TripTabs({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/trips/${tripId}`;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreMenuId = `trip-more-menu-${tripId}`;
  const moreActive =
    secondaryTabs.some((tab) => isTabActive(pathname, base, tab.href)) ||
    pathname === "/dashboard/account";

  useEffect(() => {
    if (!moreOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreOpen]);

  return (
    <div className="grid gap-2">
      <nav
        aria-label="Trip sections"
        className="relative z-[80] flex min-w-0 gap-1 overflow-visible rounded-full border border-white/10 bg-white/10 p-1 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur-2xl lg:hidden"
        data-testid="trip-section-menu"
      >
        {mobileTabs.map((tab) => {
          const href = `${base}${tab.href}`;
          const active = isTabActive(pathname, base, tab.href);

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
        <div className="relative flex-1" ref={moreRef}>
          <button
            aria-controls={moreMenuId}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            className={[
              "inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-full px-2 text-xs font-black transition",
              moreActive || moreOpen
                ? "bg-white text-slate-950 shadow-md"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            ].join(" ")}
            onClick={() => setMoreOpen((open) => !open)}
            type="button"
          >
            More
            <ChevronDown className={["h-3.5 w-3.5 transition", moreOpen ? "rotate-180" : ""].join(" ")} aria-hidden="true" />
          </button>

          {moreOpen ? (
            <div
              className="absolute right-0 top-[calc(100%+0.5rem)] z-[120] grid min-w-44 gap-1 rounded-3xl border border-white/10 bg-slate-950/96 p-2 text-slate-100 shadow-2xl backdrop-blur-2xl"
              data-testid="trip-more-menu"
              id={moreMenuId}
              role="menu"
            >
              {secondaryTabs.map((tab) => {
                const href = `${base}${tab.href}`;
                const active = isTabActive(pathname, base, tab.href);

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
                    onClick={() => setMoreOpen(false)}
                    role="menuitem"
                  >
                    {tab.label}
                  </Link>
                );
              })}
              <Link
                className="inline-flex min-h-11 items-center rounded-2xl px-3 text-sm font-black text-slate-300 hover:bg-white/10 hover:text-white"
                href="/dashboard/account"
                onClick={() => setMoreOpen(false)}
                role="menuitem"
              >
                Settings
              </Link>
            </div>
          ) : null}
        </div>
      </nav>

      <nav
        aria-label="Trip tabs"
        className="hidden gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/10 p-1 shadow-[0_18px_50px_rgba(2,6,23,0.18)] backdrop-blur-2xl sm:flex-wrap sm:overflow-visible lg:flex lg:p-1.5"
      >
        {tabs.map((tab) => {
          const href = `${base}${tab.href}`;
          const active = isTabActive(pathname, base, tab.href);

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

function isTabActive(pathname: string, base: string, href: string) {
  if (href === "") {
    return pathname === base;
  }

  if (href === "/share") {
    return pathname === `${base}/share` || pathname === `${base}/sharing`;
  }

  return pathname === `${base}${href}`;
}
