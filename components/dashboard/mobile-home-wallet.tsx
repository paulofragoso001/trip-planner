"use client";

import { LocateFixed, Map } from "lucide-react";
import Link from "next/link";
import type { DashboardData } from "@/app/dashboard/loader";
import { MobileHomeContent } from "@/components/dashboard/mobile-home-content";
import { Photorealistic3DHomeHero } from "@/components/dashboard/photorealistic-3d-home-hero";
import { cn } from "@/components/trip-ui";
import { dashboardActionRoutes } from "@/lib/dashboard/action-routes";

type MobileHomeWalletProps = Pick<DashboardData, "metrics" | "recentTrips"> & {
  className?: string;
  initialSheetState?: "collapsed" | "expanded";
};

export function MobileHomeWallet({
  className,
  initialSheetState = "collapsed",
  metrics,
  recentTrips
}: MobileHomeWalletProps) {
  const latestTrip = recentTrips[0] || null;
  const importsWaiting =
    metrics.find((metric) => metric.label === "Ideas waiting")?.value ??
    metrics.find((metric) => metric.label === "Imports waiting")?.value ??
    "0";
  const ideasWaitingCount = Number.parseInt(importsWaiting.replace(/[^\d]/g, ""), 10) || 0;
  const primaryHref = latestTrip ? latestTrip.href : "/dashboard/trips#new-trip";
  const primaryLabel = latestTrip ? "Continue trip" : "Create trip";
  const primaryMeta = latestTrip
    ? `${latestTrip.name} · ${latestTrip.destination}`
    : "Start a new travel wallet.";

  return (
    <section
      className={cn(
        "mobile-launch-globe relative isolate h-[100dvh] overflow-hidden bg-black text-white lg:hidden",
        className
      )}
      data-testid="mobile-home-wallet"
    >
      <section
        className="globe-layer absolute inset-0 overflow-hidden bg-black"
        data-testid="mobile-home-3d-hero"
      >
        <Photorealistic3DHomeHero />
        <FloatingGlobeControls />
      </section>

      <section
        className="launch-bottom-sheet pointer-events-none absolute inset-x-0 bottom-0 z-30"
        data-testid="mobile-home-wallet-stage"
      >
        <MobileHomeContent
          ideasWaitingCount={ideasWaitingCount}
          primaryHref={primaryHref}
          primaryLabel={primaryLabel}
          primaryMeta={primaryMeta}
          recentTrips={recentTrips}
          initialSheetState={initialSheetState}
        />
      </section>
    </section>
  );
}

function FloatingGlobeControls() {
  return (
    <div
      aria-label="Globe controls"
      className="absolute right-4 top-[calc(5.5rem+env(safe-area-inset-top))] z-30 overflow-hidden rounded-full border border-white/12 bg-black/68 p-1 text-white shadow-[0_18px_42px_rgba(0,0,0,0.38)] backdrop-blur-xl"
      data-testid="mobile-home-globe-controls"
      role="toolbar"
    >
      <Link
        aria-label="Open map"
        className="grid h-11 w-11 place-items-center rounded-full text-white transition hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
        href={dashboardActionRoutes.globe.openMap}
      >
        <Map aria-hidden="true" className="h-5 w-5" />
      </Link>
      <span className="mx-auto block h-px w-7 bg-white/18" />
      <button
        aria-label="Use current location"
        className="grid h-11 w-11 place-items-center rounded-full text-white transition hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
        onClick={() => {
          window.dispatchEvent(new CustomEvent(dashboardActionRoutes.globe.locateUserEvent));
        }}
        type="button"
      >
        <LocateFixed aria-hidden="true" className="h-5 w-5" />
      </button>
    </div>
  );
}
