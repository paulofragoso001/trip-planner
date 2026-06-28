import Link from "next/link";
import type { ReactNode } from "react";
import { MobileTripsWallet } from "@/components/dashboard/mobile-trips-wallet";
import { TripCreateForm } from "@/components/dashboard/trip-create-form";
import { TripRowActions } from "@/components/dashboard/trip-row-actions";
import type { TripsData } from "@/app/dashboard/trips/loader";
import { PlacePhoto } from "@/components/place-photo";
import { WalletActionLink, WalletCard } from "@/components/wallet/wallet-card";
import { WalletPageShell } from "@/components/wallet/wallet-page-shell";
import { dashboardActionRoutes } from "@/lib/dashboard/action-routes";

type TripsPageProps = TripsData;

export default function TripsPage({ error, heroImage, trips }: TripsPageProps) {
  return (
    <>
      <MobileTripsWallet error={error} trips={trips} />
      <div className="hidden lg:block">
        <WalletPageShell
          actions={
            <>
              <WalletActionLink href="#new-trip">Create trip</WalletActionLink>
              <WalletActionLink className="bg-white text-slate-950 hover:bg-slate-100" href={dashboardActionRoutes.plan.addIdea}>
                Start planning
              </WalletActionLink>
            </>
          }
          compactHero
          eyebrow="TRIPS"
          fallbackGradient={heroImage.fallbackGradient}
          heroImage={heroImage}
          subtitle="Open a trip or create a new destination pass."
          title="Your trip passes"
        >
          <div className="grid gap-6">
            <TripsWalletExperience error={error} trips={trips} />
          </div>
        </WalletPageShell>
      </div>
    </>
  );
}

function TripsWalletExperience({ error, trips }: Pick<TripsPageProps, "error" | "trips">) {
  if (!error && trips.length === 0) {
    return (
      <div className="grid gap-4" data-testid="desktop-first-trip-state">
        <WalletCard eyebrow="Almidy Trip Pass" title="Create your first trip" variant="utility">
          <p className="text-sm font-semibold leading-6 text-slate-600">
            Choose a destination and Almidy will turn it into a visual trip wallet.
          </p>
          <div className="mt-4" id="new-trip">
            <TripCreateForm formId="desktop-first-trip-form" mode="mobile-pass" redirectOnSuccess />
          </div>
        </WalletCard>
      </div>
    );
  }

  return (
    <div className="grid gap-4" data-testid="desktop-trips-wallet">
      {error ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3">
        {trips.map((trip) => (
          <article
            className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-3 shadow-sm"
            key={trip.id}
          >
            <TripCardVisual trip={trip} variant="pass" />
            <div className="px-1 pb-1">
              <div className="grid gap-2">
                <Link
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-black text-white"
                  href={trip.href}
                >
                  Open trip pass
                </Link>
                <TripRowActions
                  compact
                  destination={trip.destination}
                  endDate={trip.endDate}
                  id={trip.id}
                  name={trip.name}
                  startDate={trip.startDate}
                  travelStyle={trip.travelStyle}
                />
              </div>
            </div>
          </article>
        ))}
      </div>

      <details
        className="group rounded-[2rem] border border-slate-200 bg-white p-3 shadow-sm"
        data-testid="desktop-create-another-trip"
        id="new-trip"
      >
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-[1.5rem] px-2 py-3 text-sm font-black text-slate-950 focus:outline-none focus:ring-4 focus:ring-blue-100">
          <span>Create another trip pass</span>
          <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white group-open:hidden">
            Open
          </span>
          <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 group-open:inline">
            Close
          </span>
        </summary>
        <div className="pt-3">
          <TripCreateForm formId="desktop-new-trip-form" mode="mobile-pass" redirectOnSuccess />
        </div>
      </details>
    </div>
  );
}

function formatCount(value: number, singular: string) {
  return `${value} ${singular}${value === 1 ? "" : "s"}`;
}

function TripCardVisual({
  trip,
  variant = "default"
}: {
  trip: TripsData["trips"][number];
  variant?: "default" | "pass";
}) {
  if (variant === "pass") {
    return (
      <Link
        className="group relative isolate mb-4 block min-h-[18rem] overflow-hidden rounded-[1.75rem] bg-slate-950 p-4 text-white shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-100"
        href={trip.href}
      >
        {trip.imageUrl ? (
          <img
            alt={trip.imageAlt}
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            src={trip.imageUrl}
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,255,255,0.34),transparent_28%),linear-gradient(135deg,#0f172a,#2563eb_52%,#14b8a6)]" />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.22),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.12),rgba(2,6,23,0.88))]" />
        <div className="relative flex min-h-[16rem] flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <p className="max-w-[72%] break-words text-xs font-black uppercase tracking-[0.18em] text-white/72">
              {trip.destination}
            </p>
            <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-black text-white ring-1 ring-white/20 backdrop-blur">
              Trip Pass
            </span>
          </div>
          <div>
            <h3 className="break-words text-3xl font-black leading-none tracking-tight">
              {trip.name}
            </h3>
            <p className="mt-2 text-sm font-bold text-white/74">{trip.dateRange}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <PassChip>{formatCount(trip.stopCount, "place")}</PassChip>
              <PassChip>{trip.mappedStops} mapped</PassChip>
              <PassChip>{nearbyIdeasLabel(trip)}</PassChip>
            </div>
          </div>
        </div>
        {trip.imageAttribution ? (
          <span className="absolute bottom-3 right-3 max-w-[12rem] truncate rounded-full bg-black/34 px-3 py-1 text-[0.65rem] font-bold text-white/80 backdrop-blur">
            Photo: {trip.imageAttribution}
          </span>
        ) : null}
      </Link>
    );
  }

  if (trip.imageUrl) {
    return (
      <PlacePhoto
        alt={trip.imageAlt}
        attribution={trip.imageAttribution}
        className="mb-4 aspect-[16/9] w-full rounded-2xl"
        fallbackLabel={trip.destination}
        src={trip.imageUrl}
      />
    );
  }

  return (
    <div className="mb-4 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_18%_22%,rgba(255,255,255,0.34),transparent_28%),linear-gradient(135deg,#0f172a,#2563eb_52%,#14b8a6)] p-4 text-white shadow-sm">
      <div className="flex min-h-[7.5rem] flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <p className="max-w-[70%] break-words text-xs font-black uppercase tracking-[0.18em] text-white/75">
            {trip.destination}
          </p>
          <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-black text-white ring-1 ring-white/20">
            Trip Pass
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold text-white/75">Ready when you are</p>
          <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-white/55">
            {trip.dateRange}
          </p>
        </div>
      </div>
    </div>
  );
}

function PassChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-white/16 px-3 py-1 text-xs font-black text-white ring-1 ring-white/14 backdrop-blur">
      {children}
    </span>
  );
}

function nearbyIdeasLabel(trip: TripsData["trips"][number]) {
  if (trip.nearbyIdeasCount > 0) {
    return `${trip.nearbyIdeasCount} nearby idea${trip.nearbyIdeasCount === 1 ? "" : "s"}`;
  }
  return trip.mappedStops > 0 ? "nearby ideas" : "ideas after mapping";
}

function routeReadyLabel(trip: TripsData["trips"][number]) {
  if (trip.mappedStops > 0 && trip.needsLocationStops === 0) return "route ready";
  if (trip.mappedStops > 0) return `${trip.mappedStops} mapped`;
  return "needs locations";
}
