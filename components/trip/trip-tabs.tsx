"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const tabs = [
  { label: "Itinerary", href: "/timeline" },
  { label: "Map", href: "/map" },
  { label: "Ideas", href: "/map#smart-suggestions" },
  { label: "Budget", href: "/budget" },
  { label: "Share", href: "/sharing" }
] as const;

export function TripTabs({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/trips/${tripId}`;
  const [hash, setHash] = useState("");

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  return (
    <nav
      aria-label="Trip tabs"
      className="-mx-1 flex gap-2 overflow-x-auto rounded-[1.5rem] bg-white/80 p-1 shadow-sm ring-1 ring-slate-200 backdrop-blur sm:mx-0 sm:flex-wrap sm:overflow-visible"
    >
      {tabs.map((tab) => {
        const href = `${base}${tab.href}`;
        const active =
          tab.href === "/map"
            ? pathname === href && hash !== "#smart-suggestions"
            : tab.href === "/map#smart-suggestions"
              ? pathname === `${base}/map` && hash === "#smart-suggestions"
              : pathname === href;

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={[
              "inline-flex min-h-11 shrink-0 items-center justify-center rounded-[1.15rem] px-4 text-sm font-black transition",
              active
                ? "bg-slate-950 text-white shadow-sm"
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
