"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/components/trip-ui";

export function MobileDashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const tripWorkspaceContent = /^\/dashboard\/trips\/[^/]+/.test(pathname);
  const fullBleedContent =
    tripWorkspaceContent ||
    pathname.includes("/map") ||
    pathname === "/dashboard/imports" ||
    pathname === "/dashboard/plan" ||
    pathname.startsWith("/dashboard/layout-simulator");
  const isDashboardLaunch = pathname === "/dashboard" && (!view || view === "trips");

  return (
    <div
      className="native-map-surface-shell h-dvh overflow-hidden bg-slate-950 text-slate-100"
      data-shell-variant="mobile"
      data-wallet-shell="true"
      data-testid="app-shell-root"
    >
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-brand focus:shadow-panel"
        href="#main-content"
      >
        Skip to main content
      </a>
      <main
        className={cn(
          "native-map-surface-shell h-dvh overflow-y-auto text-slate-950",
          isDashboardLaunch ? "px-0 pt-0" : "px-3 pt-4 sm:px-6 sm:pt-6",
          tripWorkspaceContent || isDashboardLaunch
            ? "pb-0"
            : "pb-[calc(1rem+env(safe-area-inset-bottom))]",
          fullBleedContent && "px-0 pt-0"
        )}
        data-testid="app-shell-main"
        id="main-content"
      >
        <div
          className={cn("native-map-surface-shell mx-auto w-full", fullBleedContent ? "max-w-none" : "max-w-[1440px]")}
          data-testid="app-shell-content"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
