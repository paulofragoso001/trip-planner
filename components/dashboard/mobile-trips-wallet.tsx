"use client";

import { BarChart3, Plus, Search, Settings } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { TripCreateForm } from "@/components/dashboard/trip-create-form";
import { cn } from "@/components/trip-ui";
import type { TripsData } from "@/app/dashboard/trips/loader";

type MobileTripsWalletProps = Pick<TripsData, "error" | "trips">;
type Trip = TripsData["trips"][number];

export function MobileTripsWallet({ error, trips }: MobileTripsWalletProps) {
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(trips.length === 0);
  const [hydrated, setHydrated] = useState(false);
  const createRef = useRef<HTMLDivElement | null>(null);

  const filteredTrips = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return trips;

    return trips.filter((trip) =>
      [trip.name, trip.destination, trip.dateRange, trip.status]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [query, trips]);

  const groupedTrips = useMemo(() => groupTripsByYear(filteredTrips), [filteredTrips]);
  const backgroundTrip = trips.find((trip) => trip.imageUrl) || trips[0] || null;

  useEffect(() => {
    setHydrated(true);
  }, []);

  function openCreateFlow() {
    if (!hydrated) return;
    setCreateOpen(true);
    window.requestAnimationFrame(() => {
      createRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <section
      className="relative isolate -mx-3 -mt-4 min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-black text-white sm:-mx-6 sm:-mt-6 lg:hidden"
      data-hydrated={hydrated ? "true" : "false"}
      data-testid="mobile-trips-wallet-screen"
    >
      <MobileTripsBackground trip={backgroundTrip} />
      <div className="relative z-10 mx-auto grid w-full max-w-[31rem] gap-5 px-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-5">
        <header className="grid gap-5">
          <div className="flex min-h-12 items-center justify-between gap-3">
            <Link
              aria-label="Trip settings"
              className="grid h-11 w-11 place-items-center rounded-full bg-orange-500/[0.14] text-orange-400 ring-1 ring-orange-400/[0.12] transition hover:bg-orange-500/20 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
              href="/dashboard/profile"
            >
              <Settings className="h-5 w-5" aria-hidden="true" />
            </Link>
            <h1 className="text-center text-2xl font-black tracking-tight text-white">
              My Trips
            </h1>
            <div className="flex items-center gap-2">
              <Link
                aria-label="Travel stats"
                className="grid h-11 w-11 place-items-center rounded-full bg-orange-500/[0.14] text-orange-400 ring-1 ring-orange-400/[0.12] transition hover:bg-orange-500/20 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                href="/dashboard/profile#travel-stats"
              >
                <BarChart3 className="h-5 w-5" aria-hidden="true" />
              </Link>
              <button
                aria-label="Create trip"
                className="grid h-11 w-11 place-items-center rounded-full bg-orange-500/[0.14] text-orange-400 ring-1 ring-orange-400/[0.12] transition hover:bg-orange-500/20 focus:outline-none focus:ring-4 focus:ring-orange-400/20 disabled:cursor-wait disabled:opacity-60"
                disabled={!hydrated}
                onClick={openCreateFlow}
                type="button"
              >
                <Plus className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
          </div>

          <label className="relative block">
            <span className="sr-only">Search for trips</span>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/[0.42]"
              aria-hidden="true"
            />
            <input
              className="h-12 w-full rounded-full border border-white/[0.08] bg-white/10 pl-12 pr-4 text-base font-semibold text-white shadow-inner shadow-black/30 outline-none backdrop-blur-xl placeholder:text-white/[0.42] focus:border-orange-300/50 focus:ring-4 focus:ring-orange-400/15"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for trips"
              type="search"
              value={query}
            />
          </label>
        </header>

        {error ? (
          <div className="rounded-[1.5rem] border border-red-300/20 bg-red-950/50 p-4 text-sm font-bold text-red-100">
            {error}
          </div>
        ) : null}

        {trips.length === 0 ? (
          <div className="grid gap-4" data-testid="mobile-first-trip-state">
            <NoTripsCard disabled={!hydrated} onCreate={openCreateFlow} />
          </div>
        ) : (
          <div className="grid gap-6" data-testid="mobile-trips-wallet">
            {groupedTrips.length > 0 ? (
              groupedTrips.map((group) => (
                <section className="grid gap-4" key={group.year}>
                  <h2 className="text-5xl font-black leading-none tracking-tight text-orange-500">
                    {group.year}
                  </h2>
                  <div className="grid gap-4">
                    {group.trips.map((trip) => (
                      <MobileTripPassCard key={trip.id} trip={trip} />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.08] p-5 text-sm font-bold text-white/[0.72]">
                No matching trips.
              </div>
            )}
          </div>
        )}

        <section
          className={cn(
            "grid gap-3 rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-3 backdrop-blur-2xl",
            createOpen ? "shadow-[0_26px_70px_rgba(0,0,0,0.34)]" : "p-2"
          )}
          data-testid="mobile-create-another-trip"
          id="mobile-new-trip"
          ref={createRef}
        >
          {trips.length > 0 ? (
            <button
              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[1.35rem] px-3 text-left text-sm font-black text-white transition hover:bg-white/[0.08] focus:outline-none focus:ring-4 focus:ring-orange-400/15"
              disabled={!hydrated}
              onClick={() => setCreateOpen((current) => !current)}
              type="button"
            >
              <span>{createOpen ? "Close trip setup" : "Create trip"}</span>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-orange-500/[0.18] text-orange-300">
                <Plus className={cn("h-5 w-5 transition", createOpen && "rotate-45")} aria-hidden="true" />
              </span>
            </button>
          ) : null}
          {createOpen ? (
            <div className="rounded-[1.5rem] bg-white p-3 text-slate-950 shadow-2xl">
              <TripCreateForm mode="mobile-pass" redirectOnSuccess />
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}

function MobileTripsBackground({ trip }: { trip: Trip | null }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      {trip?.imageUrl ? (
        <img
          alt=""
          className="h-full w-full scale-110 object-cover opacity-30 blur-[2px]"
          src={trip.imageUrl}
        />
      ) : null}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(20,184,166,0.26),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(37,99,235,0.34),transparent_32%),linear-gradient(180deg,rgba(0,0,0,0.54),#000_34%,#000)]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(15,23,42,0.2),transparent)]" />
      <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(90deg,rgba(20,184,166,0.2),rgba(37,99,235,0.28),rgba(249,115,22,0.08))]" />
    </div>
  );
}

function NoTripsCard({ disabled, onCreate }: { disabled: boolean; onCreate: () => void }) {
  return (
    <article className="relative isolate min-h-[24rem] overflow-hidden rounded-[2.1rem] bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.22),transparent_28%),linear-gradient(135deg,#0f172a,#1d4ed8_48%,#0f766e)] p-5 text-white shadow-[0_28px_90px_rgba(0,0,0,0.46)]">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.02),rgba(2,6,23,0.82))]" />
      <div className="relative flex min-h-[21rem] flex-col justify-end">
        <p className="text-sm font-bold text-white/70">Start here</p>
        <h2 className="mt-2 text-4xl font-black leading-none tracking-tight">
          Create your first trip
        </h2>
              <p className="mt-3 max-w-sm text-sm font-semibold leading-6 text-white/[0.72]">
          Choose a destination and Wayline will open it as a visual Trip Pass.
        </p>
        <button
          className="mt-5 inline-flex min-h-12 w-fit items-center justify-center rounded-full bg-white px-5 text-sm font-black text-slate-950 shadow-xl transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-white/20 disabled:cursor-wait disabled:opacity-60"
          disabled={disabled}
          onClick={onCreate}
          type="button"
        >
          Create trip
        </button>
      </div>
    </article>
  );
}

function MobileTripPassCard({ trip }: { trip: Trip }) {
  return (
    <Link
      className="group relative isolate block min-h-[21rem] overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-[0_30px_90px_rgba(0,0,0,0.48)] focus:outline-none focus:ring-4 focus:ring-orange-400/20"
      data-testid="mobile-trip-pass-card"
      href={trip.href}
    >
      {trip.imageUrl ? (
        <img
          alt={trip.imageAlt}
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          src={trip.imageUrl}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.24),transparent_26%),linear-gradient(135deg,#0f172a,#1d4ed8_50%,#0f766e)]" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.02),rgba(2,6,23,0.24)_42%,rgba(2,6,23,0.82))]" />
      <div className="relative flex min-h-[21rem] flex-col justify-end p-6">
        <p className="text-base font-semibold text-white/[0.82]">{tripStatusLabel(trip)}</p>
        <h3 className="mt-1 break-words text-4xl font-black leading-none tracking-tight">
          {trip.name}
        </h3>
        <p className="mt-3 text-base font-bold text-white/[0.66]">{trip.dateRange}</p>
      </div>
      {trip.imageAttribution ? (
        <span className="absolute bottom-4 right-4 max-w-[13rem] truncate rounded-full bg-black/[0.34] px-3 py-1 text-[0.65rem] font-bold text-white/[0.78] backdrop-blur">
          Photo: {trip.imageAttribution}
        </span>
      ) : null}
    </Link>
  );
}

function groupTripsByYear(trips: Trip[]) {
  const groups = new Map<string, Trip[]>();
  for (const trip of trips) {
    const year = tripYear(trip);
    groups.set(year, [...(groups.get(year) || []), trip]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([year, groupTrips]) => ({ trips: groupTrips, year }));
}

function tripYear(trip: Trip) {
  const date = trip.startDate || trip.endDate;
  if (!date) return String(new Date().getFullYear());
  const year = new Date(`${date}T00:00:00.000Z`).getUTCFullYear();
  return Number.isFinite(year) ? String(year) : String(new Date().getFullYear());
}

function tripStatusLabel(trip: Trip) {
  const now = startOfTodayUtc();
  const start = trip.startDate ? startOfDayUtc(trip.startDate) : null;
  const end = trip.endDate ? startOfDayUtc(trip.endDate) : null;

  if (start && end && start <= now && now <= end) return "Happening now";
  if (start && start > now) {
    const days = Math.max(1, Math.ceil((start.getTime() - now.getTime()) / 86_400_000));
    return `Starts in ${days} day${days === 1 ? "" : "s"}`;
  }

  if (!start && !end) return "Planning";
  return trip.status || "Planning";
}

function startOfTodayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfDayUtc(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
