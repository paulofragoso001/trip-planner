"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Search, Share2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileGlobeWalletShell } from "@/components/dashboard/mobile-globe-wallet-shell";
import { TripTabs } from "@/components/trip/trip-tabs";
import type { TripWorkspaceData } from "@/app/dashboard/trips/[tripId]/loader";

type TripPassShellProps = {
  children: ReactNode;
  trip: TripWorkspaceData;
  tripId: string;
};

export function TripPassShell({ children, trip, tripId }: TripPassShellProps) {
  const pathname = usePathname();
  const hasPhoto = Boolean(trip.heroImage.imageUrl);
  const basePath = `/dashboard/trips/${tripId}`;
  const isOverviewRoute = pathname === basePath;
  const isMapRoute = pathname === `${basePath}/map`;
  const isIdeasRoute = pathname === `${basePath}/ideas`;
  const isTimelineRoute = pathname === `${basePath}/timeline`;
  const isSecondaryRoute =
    pathname === `${basePath}/budget` ||
    pathname === `${basePath}/documents` ||
    pathname === `${basePath}/share` ||
    pathname === `${basePath}/sharing`;
  const mobileImmersiveRoute = isOverviewRoute || isTimelineRoute;
  const mobileSheetRoute = mobileImmersiveRoute || isSecondaryRoute;
  const wrapInMobileGlobeWallet = (content: ReactNode) => (
    <MobileGlobeWalletShell
      initialMode={isMapRoute ? "map" : "country-map"}
      rootLayer="myTrips"
      rootRoute="/dashboard/trips"
    >
      {content}
    </MobileGlobeWalletShell>
  );

  if (isMapRoute) {
    return wrapInMobileGlobeWallet(
      <section
        className="relative isolate -mx-3 -mt-4 min-h-[100dvh] overflow-hidden bg-slate-950 sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-my-6"
        data-has-background-image="false"
        data-map-mode="true"
        data-mobile-route-hydration="globe-wallet"
        data-testid="trip-pass-shell"
      >
        <div className="relative z-10 mx-auto w-full max-w-none px-0 py-0 pb-[env(safe-area-inset-bottom)] lg:px-6 lg:py-6 lg:pb-6">
          <div
            className="min-w-0"
            data-wallet-trip-surface="map-mode"
            data-testid="trip-workspace-layout"
          >
            <div className="min-w-0" data-testid="trip-pass-active-content">
              {children}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const standardTripPass = (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-0 hidden lg:block"
        aria-hidden="true"
        data-testid="trip-pass-desktop-background"
      >
        {hasPhoto ? (
          <img
            alt=""
            className="h-full w-full scale-105 object-cover opacity-70 blur-sm"
            loading="lazy"
            src={trip.heroImage.imageUrl!}
          />
        ) : (
          <div className={`h-full w-full ${trip.heroImage.fallbackGradient}`} />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(255,255,255,0.2),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.44),rgba(2,6,23,0.88)_46%,rgba(2,6,23,0.96)_88%)]" />
      </div>

      <div
        className={[
          "relative z-10 mx-auto w-full",
          mobileSheetRoute
            ? "max-w-none px-0 py-0 pb-[env(safe-area-inset-bottom)] lg:max-w-[1180px] lg:px-8 lg:py-8 lg:pb-8"
            : "max-w-[1180px] px-3 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:px-8 lg:py-8 lg:pb-8"
        ].join(" ")}
      >
        <div
          className={mobileSheetRoute ? "overflow-visible rounded-none lg:rounded-[2.35rem]" : "overflow-visible rounded-[2.35rem]"}
          data-wallet-trip-surface="true"
          data-testid="trip-workspace-layout"
        >
          <div className={mobileSheetRoute ? "grid gap-0 lg:gap-4" : "grid gap-4"}>
            <div className={mobileSheetRoute ? "hidden lg:block" : undefined}>
              <CompactTripHeader trip={trip} tripId={tripId} />
            </div>
            <div className={mobileSheetRoute ? "hidden lg:block" : undefined}>
              <TripTabs tripId={tripId} />
            </div>
            <div className="min-w-0" data-testid="trip-pass-active-content">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (isIdeasRoute) {
    return wrapInMobileGlobeWallet(
      <section
        className="relative isolate -mx-3 -mt-4 min-h-[100dvh] overflow-hidden bg-slate-950 sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-my-6"
        data-has-background-image={hasPhoto ? "true" : "false"}
        data-ideas-mode="true"
        data-mobile-route-hydration="globe-wallet"
        data-testid="trip-pass-shell"
      >
        <div className="relative z-10 mx-auto w-full max-w-none px-0 py-0 pb-[env(safe-area-inset-bottom)] lg:px-6 lg:py-6 lg:pb-6">
          <div
            className="min-w-0"
            data-wallet-trip-surface="ideas-mode"
            data-testid="trip-workspace-layout"
          >
            <div className="min-w-0" data-testid="trip-pass-active-content">
              {children}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return wrapInMobileGlobeWallet(
    <section
      className="relative isolate -mx-3 -mt-4 min-h-[100dvh] overflow-hidden bg-slate-950 sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-my-6"
      data-has-background-image={hasPhoto ? "desktop-only" : "false"}
      data-mobile-route-hydration="globe-wallet"
      data-testid="trip-pass-shell"
    >
      {standardTripPass}
    </section>
  );
}

function CompactTripHeader({
  trip,
  tripId
}: {
  trip: TripWorkspaceData;
  tripId: string;
}) {
  const base = `/dashboard/trips/${tripId}`;

  return (
    <header
      className="flex min-w-0 items-center gap-3 rounded-[1.75rem] border border-white/10 bg-slate-950/58 p-2.5 text-white shadow-[0_18px_50px_rgba(2,6,23,0.24)] backdrop-blur-2xl sm:p-3"
      data-testid="trip-compact-header"
    >
      <Link
        aria-label="Back to trips"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/15"
        href="/dashboard/trips"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </Link>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black sm:text-base">{trip.name}</p>
        <p className="truncate text-xs font-bold text-slate-300 sm:text-sm">
          {[trip.destination, trip.dateRange].filter(Boolean).join(" · ")}
        </p>
      </div>

      <Link
        aria-label="Search trip"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/15"
        href="/dashboard/search"
      >
        <Search className="h-5 w-5" aria-hidden="true" />
      </Link>
      <Link
        aria-label="Share trip"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/15"
        href={`${base}/share`}
      >
        <Share2 className="h-5 w-5" aria-hidden="true" />
      </Link>
    </header>
  );
}
