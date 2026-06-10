"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { TripPassHero } from "@/components/trip/trip-pass-hero";
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
  const isMapRoute = pathname === `${basePath}/map`;
  const isIdeasRoute = pathname === `${basePath}/ideas`;

  if (isMapRoute) {
    return (
      <section
        className="relative isolate -mx-3 -mt-4 min-h-[100dvh] overflow-hidden bg-slate-950 sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-my-6"
        data-has-background-image="false"
        data-map-mode="true"
        data-testid="trip-pass-shell"
      >
        <div className="relative z-10 mx-auto w-full max-w-none px-0 py-0 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:px-6 lg:py-6 lg:pb-6">
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
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
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

      <div className="relative z-10 mx-auto w-full max-w-[1180px] px-3 py-3 pb-[calc(7.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 sm:pb-[calc(8rem+env(safe-area-inset-bottom))] lg:px-8 lg:py-8 lg:pb-8">
        <div
          className="overflow-visible rounded-[2.35rem]"
          data-wallet-trip-surface="true"
          data-testid="trip-workspace-layout"
        >
          <div className="grid gap-4">
            <TripPassHero trip={trip} tripId={tripId} />
            <TripTabs tripId={tripId} />
            <div className="min-w-0" data-testid="trip-pass-active-content">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (isIdeasRoute) {
    return (
      <section
        className="relative isolate -mx-3 -mt-4 min-h-[100dvh] overflow-hidden bg-slate-950 sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-my-6"
        data-has-background-image={hasPhoto ? "true" : "false"}
        data-ideas-mode="true"
        data-testid="trip-pass-shell"
      >
        <div className="relative z-10 mx-auto w-full max-w-none px-0 py-0 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:px-6 lg:py-6 lg:pb-6">
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

  return (
    <section
      className="relative isolate -mx-3 -mt-4 min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-slate-950 sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-my-6"
      data-has-background-image={hasPhoto ? "true" : "false"}
      data-testid="trip-pass-shell"
    >
      {standardTripPass}
    </section>
  );
}
