"use client";

import { BarChart3, ChevronDown, List, Plus, Search, Settings } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";
import TripMap, { type TripMapItem } from "@/components/TripMap";
import { TripCreateForm } from "@/components/dashboard/trip-create-form";
import { cn } from "@/components/trip-ui";
import type { TripsData } from "@/app/dashboard/trips/loader";

type MobileTripsWalletProps = Pick<TripsData, "error" | "trips">;
type Trip = TripsData["trips"][number];

export function MobileTripsWallet({ error, trips }: MobileTripsWalletProps) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(trips.length === 0);
  const [hydrated, setHydrated] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const createRef = useRef<HTMLDivElement | null>(null);
  const isMapView = searchParams.get("view") === "map";

  const filteredTrips = useMemo(() => {
    if (!query.trim()) return trips;

    return trips.filter((trip) => matchesTripSearch(trip, query));
  }, [query, trips]);

  const groupedTrips = useMemo(() => groupTripsByYear(filteredTrips), [filteredTrips]);
  const years = useMemo(() => groupedTrips.map((group) => group.year), [groupedTrips]);
  const activeYear = selectedYear && years.includes(selectedYear)
    ? selectedYear
    : years[0] || String(new Date().getFullYear());
  const activeYearTrips = groupedTrips.find((group) => group.year === activeYear)?.trips || [];
  const hasSearchQuery = query.trim().length > 0;
  const countryMapTrips = hasSearchQuery ? filteredTrips : activeYearTrips;
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

  if (isMapView) {
    return (
      <MobileTripsCountriesMap
        activeYear={activeYear}
        activeYearTrips={countryMapTrips}
        createOpen={createOpen}
        createRef={createRef}
        error={error}
        hydrated={hydrated}
        onCreate={openCreateFlow}
        query={query}
        setCreateOpen={setCreateOpen}
        setQuery={setQuery}
        setSelectedYear={setSelectedYear}
        years={years}
      />
    );
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
              href="/dashboard/profile/stats"
            >
              <Settings className="h-5 w-5" aria-hidden="true" />
            </Link>
            <h1 className="text-center text-2xl font-black tracking-tight text-white">
              My Trips
            </h1>
            <div className="flex items-center gap-2">
              <Link
                aria-label="Show trips map"
                className="grid h-11 w-11 place-items-center rounded-full bg-orange-500/[0.14] text-orange-400 ring-1 ring-orange-400/[0.12] transition hover:bg-orange-500/20 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                href="/dashboard/trips?view=map"
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

type MobileTripsCountriesMapProps = {
  activeYear: string;
  activeYearTrips: Trip[];
  createOpen: boolean;
  createRef: RefObject<HTMLDivElement | null>;
  error: string | null;
  hydrated: boolean;
  onCreate: () => void;
  query: string;
  setCreateOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  setQuery: (value: string) => void;
  setSelectedYear: (value: string) => void;
  years: string[];
};

function MobileTripsCountriesMap({
  activeYear,
  activeYearTrips,
  createOpen,
  createRef,
  error,
  hydrated,
  onCreate,
  query,
  setCreateOpen,
  setQuery,
  setSelectedYear,
  years
}: MobileTripsCountriesMapProps) {
  const markerTrips = activeYearTrips.filter(hasTripCoordinates);
  const hasSearchQuery = query.trim().length > 0;
  const visibleTripRows = hasSearchQuery ? activeYearTrips : activeYearTrips.slice(0, 5);

  return (
    <section
      className="relative isolate -mx-3 -mt-4 min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-black text-white sm:-mx-6 sm:-mt-6 lg:hidden"
      data-hydrated={hydrated ? "true" : "false"}
      data-testid="mobile-trips-country-map-screen"
    >
      <MobileCountryMapCanvas trips={markerTrips} />

      <div className="absolute inset-x-0 bottom-0 z-20 px-2 pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:px-4">
        <div className="mx-auto max-h-[64dvh] w-full max-w-[31rem] overflow-y-auto rounded-t-[2rem] border border-white/10 bg-black/92 p-4 shadow-[0_-26px_80px_rgba(0,0,0,0.52)] backdrop-blur-2xl">
          <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/45" aria-hidden="true" />

          <div className="flex min-h-11 items-center justify-between gap-3">
            <Link
              aria-label="Trip settings"
              className="grid h-10 w-10 place-items-center rounded-full bg-orange-500/[0.14] text-orange-400 ring-1 ring-orange-400/[0.12] transition hover:bg-orange-500/20 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
              href="/dashboard/profile/stats"
            >
              <Settings className="h-5 w-5" aria-hidden="true" />
            </Link>
            <h1 className="text-center text-2xl font-black tracking-tight text-white">
              My Trips
            </h1>
            <div className="flex items-center gap-2">
              <Link
                aria-label="Show trip cards"
                className="grid h-10 w-10 place-items-center rounded-full bg-orange-500/[0.14] text-orange-400 ring-1 ring-orange-400/[0.12] transition hover:bg-orange-500/20 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                href="/dashboard/trips"
              >
                <List className="h-5 w-5" aria-hidden="true" />
              </Link>
              <button
                aria-label="Create trip"
                className="grid h-10 w-10 place-items-center rounded-full bg-orange-500/[0.14] text-orange-400 ring-1 ring-orange-400/[0.12] transition hover:bg-orange-500/20 focus:outline-none focus:ring-4 focus:ring-orange-400/20 disabled:cursor-wait disabled:opacity-60"
                disabled={!hydrated}
                onClick={onCreate}
                type="button"
              >
                <Plus className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="relative block">
              <span className="sr-only">Search for trips</span>
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/[0.42]"
                aria-hidden="true"
              />
              <input
                className="h-12 w-full rounded-full border border-white/[0.08] bg-white/10 pl-12 pr-4 text-base font-semibold text-white shadow-inner shadow-black/30 outline-none placeholder:text-white/[0.42] focus:border-orange-300/50 focus:ring-4 focus:ring-orange-400/15"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search for trips"
                type="search"
                value={query}
              />
            </label>

            <label className="relative inline-flex w-fit items-center">
              <span className="sr-only">Trip year</span>
              <select
                className="h-12 appearance-none rounded-full border border-transparent bg-transparent py-0 pl-0 pr-9 text-5xl font-black leading-none tracking-tight text-orange-500 outline-none focus:ring-4 focus:ring-orange-400/20"
                onChange={(event) => setSelectedYear(event.target.value)}
                value={activeYear}
              >
                {(years.length ? years : [activeYear]).map((year) => (
                  <option className="bg-black text-white" key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none ml-[-2rem] h-7 w-7 text-orange-500" aria-hidden="true" />
            </label>
          </div>

          {error ? (
            <div className="mt-4 rounded-[1.5rem] border border-red-300/20 bg-red-950/50 p-4 text-sm font-bold text-red-100">
              {error}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3" data-testid="mobile-country-trip-list">
            {activeYearTrips.length ? (
              visibleTripRows.map((trip) => (
                <MobileCountryTripRow key={trip.id} trip={trip} />
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.08] p-4 text-sm font-bold text-white/70">
                No matching trips.
              </div>
            )}
          </div>

          {!hasSearchQuery && activeYearTrips.length > 5 ? (
            <Link
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
              href="/dashboard/trips"
            >
              View all trip cards
            </Link>
          ) : null}

          {markerTrips.length === 0 && activeYearTrips.length > 0 ? (
            <div className="mt-4 rounded-[1.5rem] border border-orange-300/15 bg-orange-500/[0.1] p-4 text-xs font-bold leading-5 text-orange-100">
              Trips without saved destination coordinates stay in this list and are not shown on the map.
            </div>
          ) : null}

          <section
            className={cn(
              "mt-4 grid gap-3 rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-3",
              createOpen ? "shadow-[0_26px_70px_rgba(0,0,0,0.34)]" : "p-2"
            )}
            id="mobile-new-trip"
            ref={createRef}
          >
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
            {createOpen ? (
              <div className="rounded-[1.5rem] bg-white p-3 text-slate-950 shadow-2xl">
                <TripCreateForm mode="mobile-pass" redirectOnSuccess />
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </section>
  );
}

function MobileCountryMapCanvas({ trips }: { trips: Trip[] }) {
  const mapItems = useMemo(
    () => trips.map((trip, index) => tripToMapItem(trip, index)),
    [trips]
  );

  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden bg-slate-950"
      data-testid="mobile-country-map-canvas"
    >
      {mapItems.length ? (
        <GoogleMapsProvider>
          <TripMap
            height="100dvh"
            items={mapItems}
            selectedId={mapItems[0]?.id}
            showRouteDetails={false}
          />
        </GoogleMapsProvider>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_19%_18%,rgba(20,184,166,0.32),transparent_27%),radial-gradient(circle_at_62%_28%,rgba(37,99,235,0.38),transparent_32%),linear-gradient(180deg,#0b1d2d,#06101d_58%,#020617)]" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.08),rgba(2,6,23,0.18)_42%,rgba(2,6,23,0.78))]" />
      {trips.map((trip) => (
        <Link
          aria-label={`Open ${trip.name}`}
          className="sr-only"
          data-testid="mobile-country-map-marker"
          href={trip.href}
          key={trip.id}
        >
          {destinationMapLabel(trip)}
        </Link>
      ))}
    </div>
  );
}

function tripToMapItem(trip: Trip, index: number): TripMapItem {
  return {
    address: trip.destination,
    category: tripStatusLabel(trip),
    dayLabel: tripYear(trip),
    id: trip.id,
    imageAlt: trip.imageAlt,
    imageAttribution: trip.imageAttribution,
    imageUrl: trip.imageUrl,
    lat: trip.destinationLat!,
    lng: trip.destinationLng!,
    routeOrder: index + 1,
    title: destinationMapLabel(trip)
  };
}

function MobileCountryTripRow({ trip }: { trip: Trip }) {
  const hasCoordinates = hasTripCoordinates(trip);

  return (
    <Link
      className="grid min-h-[4.75rem] grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-[1.35rem] border border-white/10 bg-white/[0.06] p-2 text-white transition hover:bg-white/[0.1] focus:outline-none focus:ring-4 focus:ring-orange-400/20"
      href={trip.href}
    >
      <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-white/10">
        {trip.imageUrl ? (
          <img alt="" className="h-full w-full object-cover" src={trip.imageUrl} />
        ) : (
          <div className="grid h-full w-full place-items-center text-xl">
            {destinationFlag(trip.destination)}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="truncate text-sm font-black text-white">{trip.name}</p>
          <span className={cn(
            "shrink-0 rounded-full px-2 py-1 text-[0.65rem] font-black",
            hasCoordinates ? "bg-emerald-400/15 text-emerald-200" : "bg-white/10 text-white/[0.58]"
          )}>
            {hasCoordinates ? "Mapped" : "List only"}
          </span>
        </div>
        <p className="mt-1 truncate text-xs font-semibold text-white/[0.58]">{trip.destination}</p>
        <p className="mt-1 truncate text-xs font-semibold text-orange-300/80">
          {tripStatusLabel(trip)} · {trip.dateRange}
        </p>
      </div>
    </Link>
  );
}

function normalizeTripSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesTripSearch(trip: Trip, query: string) {
  const terms = normalizeTripSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = normalizeTripSearch(
    [
      trip.name,
      trip.destination,
      trip.dateRange,
      trip.status,
      trip.startDate,
      trip.endDate
    ]
      .filter(Boolean)
      .join(" ")
  );

  return terms.every((term) => haystack.includes(term));
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

function hasTripCoordinates(trip: Trip) {
  return (
    typeof trip.destinationLat === "number" &&
    Number.isFinite(trip.destinationLat) &&
    typeof trip.destinationLng === "number" &&
    Number.isFinite(trip.destinationLng)
  );
}

function projectTripPoint(trip: Trip) {
  if (!hasTripCoordinates(trip)) return null;
  const lat = trip.destinationLat!;
  const lng = trip.destinationLng!;

  return {
    x: clamp(((lng + 180) / 360) * 100, 7, 93),
    y: clamp(((90 - lat) / 180) * 100, 8, 78)
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function destinationMapLabel(trip: Trip) {
  const destination = trip.destination.replace(/\s*,\s*(United States|USA|US|Canada|Japan|Spain)$/i, "");
  return destination.split(",")[0]?.trim() || trip.name;
}

function destinationFlag(destination: string) {
  const value = destination.toLowerCase();
  if (/(canada|vancouver|toronto|montreal)/.test(value)) return "🇨🇦";
  if (/(japan|tokyo|osaka|kyoto)/.test(value)) return "🇯🇵";
  if (/(spain|barcelona|madrid)/.test(value)) return "🇪🇸";
  if (/(france|paris)/.test(value)) return "🇫🇷";
  if (/(brazil|rio|sao paulo|são paulo)/.test(value)) return "🇧🇷";
  if (/(colombia|bogota|bogotá|cartagena)/.test(value)) return "🇨🇴";
  if (/(panama)/.test(value)) return "🇵🇦";
  if (/(chile|santiago)/.test(value)) return "🇨🇱";
  if (/(aruba)/.test(value)) return "🇦🇼";
  if (/(united states|usa|miami|new york|los angeles|san francisco|houston|beverly hills|newark)/.test(value)) return "🇺🇸";
  return "•";
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
