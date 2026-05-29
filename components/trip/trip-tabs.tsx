"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const tabs = [
  { label: "Timeline", href: "/timeline" },
  { label: "Map", href: "/map" },
  { label: "Suggestions", href: "/map#smart-suggestions" },
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
    <nav aria-label="Trip tabs" className="flex flex-wrap gap-2">
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
