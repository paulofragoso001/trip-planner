"use client";

import { Globe2, MapPin, Navigation } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { DashboardData } from "@/app/dashboard/loader";
import { CustomGlobeRenderer } from "@/components/map/custom-globe-renderer";
import { TravelWalletSheet } from "@/components/dashboard/travel-wallet-sheet";
import { cn } from "@/components/trip-ui";
import { dashboardActionRoutes } from "@/lib/dashboard/action-routes";
import { unifiedMapSurfaceEnabled } from "@/lib/map/feature-flags";
import { UnifiedMapProvider, useUnifiedMap } from "@/lib/map/unified-map-provider";
import { countryCodeToFlag } from "@/lib/map/wayline-map-pins";

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
  const primaryHref = latestTrip ? latestTrip.href : "/dashboard/trips?view=list#new-trip";
  const primaryLabel = latestTrip ? "Continue trip" : "Create trip";
  const primaryMeta = latestTrip
    ? `${latestTrip.name} · ${latestTrip.destination}`
    : "Start a new travel wallet.";

  const walletSurface = (
    <section
      className={cn(
        "mobile-launch-globe relative isolate h-[100dvh] overflow-hidden bg-black text-white lg:hidden",
        className
      )}
      data-testid="mobile-home-wallet"
      data-unified-map-surface={unifiedMapSurfaceEnabled ? "enabled" : "disabled"}
    >
      <section
        className="globe-layer absolute inset-x-0 bottom-0 top-0 overflow-hidden bg-black"
        data-testid="mobile-home-launch-globe"
      >
        <CustomGlobeRenderer />
        <FloatingGlobeControls />
      </section>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[42dvh] bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(2,6,23,0.14)_34%,rgba(2,6,23,0.78)_100%)]"
      />
      {!latestTrip && unifiedMapSurfaceEnabled ? (
        <LaunchFirstTripCard href={dashboardActionRoutes.trips.create} />
      ) : null}

      <section
        className="launch-bottom-sheet pointer-events-none absolute inset-x-0 bottom-0 z-30"
        data-testid="mobile-home-wallet-stage"
      >
        <TravelWalletSheet
          ideasWaitingCount={ideasWaitingCount}
          primaryHref={primaryHref}
          primaryLabel={primaryLabel}
          primaryMeta={primaryMeta}
          recentTrips={recentTrips}
          initialSheetState={initialSheetState}
        />
      </section>
      {unifiedMapSurfaceEnabled ? <LaunchLocationPermissionOverlay /> : null}
    </section>
  );

  if (!unifiedMapSurfaceEnabled) {
    return walletSurface;
  }

  return (
    <UnifiedMapProvider autoLocate autoLocateMode="granted" initialMode="globe">
      {walletSurface}
    </UnifiedMapProvider>
  );
}

function LaunchFirstTripCard({ href }: { href: string }) {
  const { location } = useUnifiedMap();
  const countryFlag = countryCodeToFlag(location.countryCode);

  if (location.source !== "browser" || !countryFlag) {
    return null;
  }

  return (
    <section
      aria-label="Create your first trip"
      className="pointer-events-none absolute inset-x-4 top-[calc(5.75rem+env(safe-area-inset-top))] z-30"
      data-testid="launch-first-trip-card"
    >
      <div className="pointer-events-auto grid min-h-[9.5rem] grid-cols-[4.25rem_minmax(0,1fr)] gap-4 rounded-[1.65rem] bg-white px-4 py-5 text-slate-950 shadow-[0_20px_52px_rgba(0,0,0,0.28)] ring-1 ring-black/5 min-[390px]:min-h-[10.25rem] min-[390px]:rounded-[1.85rem] min-[390px]:px-5">
        <div
          aria-hidden="true"
          className="grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-[2.25rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
          data-testid="launch-first-trip-country-flag"
        >
          {countryFlag}
        </div>
        <div className="min-w-0">
          <h2 className="text-[1.45rem] font-black leading-tight tracking-normal text-slate-950 min-[390px]:text-[1.65rem]">
            Create your first trip
          </h2>
          <p className="mt-2 text-[1.02rem] font-semibold leading-snug text-slate-400 min-[390px]:text-[1.12rem]">
            After creating a trip, a country flag will appear on the map to mark its location.
          </p>
          <Link
            className="mt-4 inline-flex min-h-10 items-center rounded-full text-[1.08rem] font-black text-orange-500 transition hover:text-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
            data-testid="launch-first-trip-create"
            href={href}
          >
            Create Trip
          </Link>
        </div>
      </div>
    </section>
  );
}

function LaunchLocationPermissionOverlay() {
  const { locateUser, location, locationError, locationStatus } = useUnifiedMap();
  const [dismissed, setDismissed] = useState(false);
  const isLocating = locationStatus === "loading";
  const isReady = location.source === "browser" && Boolean(location.coordinate);
  const isVisible = !dismissed && !isReady;

  async function requestLocation() {
    await locateUser();
  }

  if (!isVisible) {
    return null;
  }

  return (
    <section
      aria-labelledby="launch-location-title"
      aria-modal="true"
      className="absolute inset-0 z-50 flex items-center justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]"
      data-testid="launch-location-permission"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-black/14 backdrop-blur-[2px]"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-[23rem] overflow-hidden rounded-[2.45rem] border border-white/55 bg-white/78 p-6 text-slate-950 shadow-[0_30px_90px_rgba(0,0,0,0.42)] ring-1 ring-black/5 backdrop-blur-2xl min-[390px]:p-7">
        <div className="flex items-end gap-0">
          <span className="grid h-20 w-20 place-items-center rounded-[1.55rem] bg-blue-500 text-white shadow-[0_16px_38px_rgba(37,99,235,0.35)]">
            <Navigation className="h-11 w-11 fill-white" aria-hidden="true" />
          </span>
          <span className="-ml-5 grid h-11 w-11 place-items-center rounded-[1rem] bg-blue-500 text-white shadow-[0_12px_28px_rgba(37,99,235,0.32)] ring-2 ring-white/70">
            <MapPin className="h-6 w-6 fill-white" aria-hidden="true" />
          </span>
        </div>

        <h2
          className="mt-10 max-w-[16rem] text-[2rem] font-black leading-[1.08] tracking-normal text-slate-950 min-[390px]:text-[2.2rem]"
          id="launch-location-title"
        >
          Allow "Almidy" to use your location?
        </h2>
        <p className="mt-5 text-[1.35rem] font-medium leading-[1.22] text-slate-600 min-[390px]:text-[1.55rem]">
          Show your location on the globe, and the places around you.
        </p>

        {locationStatus === "error" && locationError ? (
          <p className="mt-4 rounded-2xl bg-white/58 px-4 py-3 text-sm font-bold leading-5 text-slate-600">
            {locationError}
          </p>
        ) : null}

        <div className="mt-7 grid gap-3">
          <LocationPermissionButton disabled={isLocating} onClick={requestLocation}>
            {isLocating ? "Locating..." : "Allow Once"}
          </LocationPermissionButton>
          <LocationPermissionButton disabled={isLocating} onClick={requestLocation}>
            Allow While Using App
          </LocationPermissionButton>
          <LocationPermissionButton onClick={() => setDismissed(true)}>
            Don't Allow
          </LocationPermissionButton>
        </div>
      </div>
    </section>
  );
}

function LocationPermissionButton({
  children,
  disabled,
  onClick
}: {
  children: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="min-h-16 rounded-full bg-white/58 px-5 text-center text-[1.35rem] font-medium text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition hover:bg-white/72 focus:outline-none focus:ring-4 focus:ring-blue-400/20 disabled:cursor-wait disabled:opacity-70 min-[390px]:text-[1.5rem]"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function FloatingGlobeControls() {
  return (
    <div
      aria-label="Globe controls"
      className="absolute right-4 top-[calc(7.25rem+env(safe-area-inset-top))] z-30 overflow-hidden rounded-full border border-white/10 bg-[#111]/82 p-1.5 text-white shadow-[0_18px_42px_rgba(0,0,0,0.42)] backdrop-blur-xl"
      data-testid="mobile-home-globe-controls"
      role="toolbar"
    >
      <Link
        aria-label="Open map"
        className="grid h-12 w-12 place-items-center rounded-full text-white transition hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
        href={dashboardActionRoutes.globe.openMap}
      >
        <Globe2 aria-hidden="true" className="h-6 w-6" />
      </Link>
      <span className="mx-auto my-1 block h-px w-7 bg-white/18" />
      <button
        aria-label="Use current location"
        className="grid h-12 w-12 place-items-center rounded-full text-white transition hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
        onClick={() => {
          window.dispatchEvent(new CustomEvent(dashboardActionRoutes.globe.locateUserEvent));
        }}
        type="button"
      >
        <Navigation aria-hidden="true" className="h-6 w-6" />
      </button>
    </div>
  );
}
