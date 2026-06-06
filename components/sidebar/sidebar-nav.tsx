"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/components/trip-ui";
import type { NavSection } from "./nav-data";

type SidebarNavProps = {
  sections: NavSection[];
  collapsed?: boolean;
  onNavigate?: () => void;
};

const LAST_TRIP_STORAGE_KEY = "wayline:last-trip-id";

export function SidebarNav({
  sections,
  collapsed = false,
  onNavigate
}: SidebarNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const [hash, setHash] = useState("");
  const [targetTripId, setTargetTripId] = useState<string | null>(null);

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  useEffect(() => {
    const tripId = readTripId(pathname);

    if (tripId) {
      window.localStorage.setItem(LAST_TRIP_STORAGE_KEY, tripId);
      setTargetTripId(tripId);
      return;
    }

    const stored = window.localStorage.getItem(LAST_TRIP_STORAGE_KEY);
    if (stored) {
      setTargetTripId(stored);
      return;
    }

    let cancelled = false;

    fetch("/api/trips", { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled) {
          return;
        }

        const firstTripId = readFirstTripId(payload);
        if (firstTripId) {
          window.localStorage.setItem(LAST_TRIP_STORAGE_KEY, firstTripId);
          setTargetTripId(firstTripId);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <nav
      aria-label="Primary"
      className="space-y-6"
      data-testid="app-shell-nav"
      data-wallet-sidebar-nav="true"
    >
      {sections.map((section) => (
        <section className="space-y-3" key={section.title}>
          <h2
            className={cn(
              "px-2 text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400",
              "text-slate-500",
              collapsed && "sr-only"
            )}
          >
            {section.title}
          </h2>

          <ul className="space-y-2">
            {section.items.map((item) => {
              const Icon = item.icon;
              const href = item.getHref?.(pathname, targetTripId) ?? item.href;
              const active =
                item.match?.(pathname, view, hash) ??
                (pathname === item.href || pathname.startsWith(`${item.href}/`));
              const itemKey = `${section.title}:${item.label}:${href}`;

              return (
                <li key={itemKey}>
                  <Link
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={cn(
                      "group flex min-h-11 items-center gap-3 rounded-2xl px-3 py-3.5 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-white/14 text-white shadow-[0_16px_42px_rgba(37,99,235,0.18)] ring-1 ring-white/12 hover:bg-white/18"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    )}
                    href={href}
                    onClick={() => {
                      const nextUrl = new URL(href, window.location.href);
                      setHash(nextUrl.hash);
                      onNavigate?.();
                    }}
                    title={collapsed ? item.label : undefined}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold transition",
                        active
                          ? "bg-blue-500 text-white shadow-[0_10px_28px_rgba(37,99,235,0.28)]"
                          : "bg-white/10 text-slate-300 group-hover:bg-white/15 group-hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.4} />
                    </span>

                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate",
                        collapsed && "sr-only"
                      )}
                    >
                      {item.label}
                    </span>

                    {item.badge && !collapsed ? (
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold text-inherit">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}

function readTripId(pathname: string) {
  const match = pathname.match(/^\/dashboard\/trips\/([^/]+)/);
  return match?.[1] || null;
}

function readFirstTripId(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "trips" in payload &&
    Array.isArray(payload.trips)
  ) {
    const first = payload.trips[0];
    if (
      typeof first === "object" &&
      first !== null &&
      "id" in first &&
      typeof first.id === "string"
    ) {
      return first.id;
    }
  }

  return null;
}
