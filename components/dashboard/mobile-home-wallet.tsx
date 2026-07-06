"use client";

import { Globe2, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DashboardData } from "@/app/dashboard/loader";
import { AlmidyLaunchGlobe } from "@/components/dashboard/almidy-launch-globe";
import { TravelWalletSheet } from "@/components/dashboard/travel-wallet-sheet";
import { cn } from "@/components/trip-ui";
import { dashboardActionRoutes } from "@/lib/dashboard/action-routes";
import { unifiedMapSurfaceEnabled } from "@/lib/map/feature-flags";
import { UnifiedMapProvider, useUnifiedMap } from "@/lib/map/unified-map-provider";
import { countryCodeToFlag } from "@/lib/map/wayline-map-pins";
import { canOpenNativeMap, openNativeMap, type NativeMapTrip } from "@/lib/native-map";

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
  const resolvedInitialSheetState = initialSheetState;
  const [isCreatingFirstTrip, setIsCreatingFirstTrip] = useState(false);
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
  const nativeTrips = useMemo(() => recentTrips.map(mapRecentTripToNativeMapTrip), [recentTrips]);

  useEffect(() => {
    if (!canOpenNativeMap() || nativeTrips.length === 0) {
      return;
    }

    const launchKey = `almidy:native-launch-opened:${nativeTrips[0]?.id ?? "latest"}`;
    if (window.sessionStorage.getItem(launchKey)) {
      return;
    }

    window.sessionStorage.setItem(launchKey, "true");
    void openNativeMap(nativeTrips).catch((error) => {
      console.error("Unable to open native launch map", error);
      window.sessionStorage.removeItem(launchKey);
    });
  }, [nativeTrips]);

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
        <AlmidyLaunchGlobe
          className="absolute inset-0 h-full w-full"
          defaultFocusWhenEmpty
          showCountryPin={false}
          useLocationFocus
        />
        <FloatingGlobeControls nativeTrips={nativeTrips} />
      </section>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[42dvh] bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(2,6,23,0.14)_34%,rgba(2,6,23,0.78)_100%)]"
      />
      {!latestTrip && unifiedMapSurfaceEnabled ? (
        <LaunchFirstTripCard
          href={dashboardActionRoutes.trips.create}
          onCreateTripStart={() => {
            setIsCreatingFirstTrip(true);
          }}
        />
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
          forceExpanded={isCreatingFirstTrip}
          initialSheetState={resolvedInitialSheetState}
        />
      </section>
    </section>
  );

  if (!unifiedMapSurfaceEnabled) {
    return walletSurface;
  }

  return <UnifiedMapProvider initialMode="globe">{walletSurface}</UnifiedMapProvider>;
}

function LaunchFirstTripCard({
  href,
  onCreateTripStart
}: {
  href: string;
  onCreateTripStart: () => void;
}) {
  const router = useRouter();
  const { location } = useUnifiedMap();
  const countryFlag = location.source === "browser" ? countryCodeToFlag(location.countryCode) : null;
  const navigationTimeoutRef = useRef<number | null>(null);
  const [isSlidingOut, setIsSlidingOut] = useState(false);

  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        window.clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  function createTrip(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (isSlidingOut) return;

    setIsSlidingOut(true);
    onCreateTripStart();
    navigationTimeoutRef.current = window.setTimeout(() => {
      router.push(href);
    }, 500);
  }

  return (
    <section
      aria-label="Create your first trip"
      className={cn(
        "trip-card-overlay absolute inset-x-4 top-[max(4rem,calc(env(safe-area-inset-top)+1rem))] z-30 transform-gpu transition-[opacity,transform] duration-[400ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
        isSlidingOut
          ? "slide-out-up pointer-events-none -translate-y-[130%] opacity-0"
          : "pointer-events-none translate-y-0 opacity-100"
      )}
      data-testid="launch-first-trip-card"
      id="create-trip-card"
    >
      <div
        className={cn(
          "grid min-h-[6.75rem] grid-cols-[3.25rem_minmax(0,1fr)] gap-3 rounded-[1.4rem] bg-white px-3.5 py-3 text-slate-950 shadow-[0_18px_46px_rgba(0,0,0,0.24)] ring-1 ring-black/5 min-[390px]:min-h-[7.15rem] min-[390px]:grid-cols-[3.5rem_minmax(0,1fr)] min-[390px]:rounded-[1.55rem] min-[390px]:px-4",
          isSlidingOut ? "pointer-events-none" : "pointer-events-auto"
        )}
      >
        <div
          aria-hidden="true"
          className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-[1.95rem] text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] min-[390px]:h-[3.25rem] min-[390px]:w-[3.25rem] min-[390px]:text-[2.1rem]"
          data-has-country-flag={countryFlag ? "true" : "false"}
          data-testid="launch-first-trip-country-flag"
        >
          {countryFlag ?? <MapPin aria-hidden="true" className="h-6 w-6" />}
        </div>
        <div className="min-w-0">
          <h2 className="text-[1.18rem] font-black leading-tight tracking-normal text-slate-950 min-[390px]:text-[1.32rem]">
            Create your first trip
          </h2>
          <p className="mt-1 text-[0.9rem] font-semibold leading-snug text-slate-400 min-[390px]:text-[0.98rem]">
            After creating a trip, a country flag will appear on the map to mark its location.
          </p>
          <Link
            className="mt-2 inline-flex min-h-8 items-center rounded-full text-[0.98rem] font-black text-orange-500 transition hover:text-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-300/20 min-[390px]:text-[1.05rem]"
            data-testid="launch-first-trip-create"
            href={href}
            id="create-trip-btn"
            onClick={createTrip}
          >
            Create Trip
          </Link>
        </div>
      </div>
    </section>
  );
}

function mapRecentTripToNativeMapTrip(trip: DashboardData["recentTrips"][number]): NativeMapTrip {
  return {
    dateRange: trip.dateRange,
    destination: trip.destination,
    href: trip.href,
    id: trip.id,
    name: trip.name,
    status: trip.status
  };
}

function FloatingGlobeControls({
  nativeTrips
}: {
  nativeTrips: NativeMapTrip[];
}) {
  const [showNativeMapControl, setShowNativeMapControl] = useState(false);

  useEffect(() => {
    setShowNativeMapControl(canOpenNativeMap());
  }, []);

  return (
    <div
      aria-label="Globe controls"
      className="absolute right-4 top-[max(12.25rem,calc(env(safe-area-inset-top)+9.25rem))] z-30 overflow-hidden rounded-full border border-white/10 bg-[#111]/82 p-1.5 text-white shadow-[0_18px_42px_rgba(0,0,0,0.42)] backdrop-blur-xl"
      data-testid="mobile-home-globe-controls"
      role="toolbar"
    >
      {showNativeMapControl ? (
        <button
          aria-label="Open native map"
          className="grid h-12 w-12 place-items-center rounded-full text-white transition hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
          onClick={() => {
            void openNativeMap(nativeTrips).catch((error) => {
              console.error("Unable to open native map", error);
            });
          }}
          type="button"
        >
          <Globe2 aria-hidden="true" className="h-6 w-6" />
        </button>
      ) : (
        <Link
          aria-label="Open map"
          className="grid h-12 w-12 place-items-center rounded-full text-white transition hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
          href={dashboardActionRoutes.globe.openMap}
        >
          <Globe2 aria-hidden="true" className="h-6 w-6" />
        </Link>
      )}
    </div>
  );
}
