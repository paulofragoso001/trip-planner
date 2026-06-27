"use client";

import { BarChart3, CalendarDays, ChevronDown, List, LocateFixed, MapPinned, Plus, Search, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject, ReactNode, RefObject } from "react";
import { TripCreateForm } from "@/components/dashboard/trip-create-form";
import { CustomGlobeRenderer } from "@/components/map/custom-globe-renderer";
import { cn } from "@/components/trip-ui";
import type { TripsData } from "@/app/dashboard/trips/loader";
import { dashboardActionRoutes } from "@/lib/dashboard/action-routes";
import { unifiedMapSurfaceEnabled } from "@/lib/map/feature-flags";
import {
  UnifiedMapProvider,
  useOptionalUnifiedMap
} from "@/lib/map/unified-map-provider";
import {
  buildTripPin,
  countryCodeFromDestinationText,
  countryCodeToFlag
} from "@/lib/map/wayline-map-pins";
import type {
  AlmidyLaunchGlobeTripPin,
  AlmidyMapPin
} from "@/lib/map/wayline-map-models";

type MobileTripsWalletProps = Pick<TripsData, "error" | "trips">;
type Trip = TripsData["trips"][number];

export function MobileTripsWallet({ error, trips }: MobileTripsWalletProps) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(trips.length === 0);
  const [hydrated, setHydrated] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const createRef = useRef<HTMLDivElement | null>(null);
  const isListView = searchParams.get("view") === "list";

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
  const visibleTripGroups = hasSearchQuery
    ? groupedTrips
    : activeYearTrips.length
      ? [{ trips: activeYearTrips, year: activeYear }]
      : [];

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

  if (unifiedMapSurfaceEnabled && !isListView) {
    return (
      <UnifiedMapProvider autoLocate initialMode="country-map">
        <MobileTripsCountriesMap
          activeYearTrips={countryMapTrips}
          activeYear={activeYear}
          hydrated={hydrated}
          onQueryChange={setQuery}
          onYearChange={setSelectedYear}
          query={query}
          years={years}
        />
      </UnifiedMapProvider>
    );
  }

  return (
    <section
      className="relative isolate -mx-3 -mt-4 min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-black text-white sm:-mx-6 sm:-mt-6 lg:hidden"
      data-hydrated={hydrated ? "true" : "false"}
      data-testid="mobile-trips-wallet-screen"
      data-unified-map-surface={unifiedMapSurfaceEnabled ? "enabled" : "disabled"}
    >
      <MobileTripsBackground />
      <div className="relative z-10 mx-auto grid w-full max-w-[31rem] gap-5 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-5">
        <header className="grid gap-5">
          <div className="flex min-h-12 items-center justify-between gap-3">
            <Link
              aria-label="Trip settings"
              className="grid h-11 w-11 place-items-center rounded-full bg-orange-500/[0.14] text-orange-400 ring-1 ring-orange-400/[0.12] transition hover:bg-orange-500/20 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
              href={dashboardActionRoutes.settings.account}
            >
              <Settings className="h-5 w-5" aria-hidden="true" />
            </Link>
            <h1 className="text-center text-2xl font-black tracking-tight text-white">
              My Trips
            </h1>
            <div className="flex items-center gap-2">
              <Link
                aria-label="Open travel stats"
                className="grid h-11 w-11 place-items-center rounded-full bg-orange-500/[0.14] text-orange-400 ring-1 ring-orange-400/[0.12] transition hover:bg-orange-500/20 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                data-testid="mobile-trips-stats-link"
                href={dashboardActionRoutes.trips.stats}
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
            {visibleTripGroups.length > 0 ? (
              visibleTripGroups.map((group) => (
                <section className="grid gap-4" key={group.year}>
                  <label className="relative inline-flex w-fit items-center">
                    <span className="sr-only">Trip year</span>
                    <select
                      className="h-12 appearance-none rounded-full border border-transparent bg-transparent py-0 pl-0 pr-9 text-5xl font-black leading-none tracking-tight text-orange-500 outline-none focus:ring-4 focus:ring-orange-400/20"
                      onChange={(event) => setSelectedYear(event.target.value)}
                      value={group.year}
                    >
                      {years.map((year) => (
                        <option className="bg-black text-white" key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none ml-[-2.1rem] h-7 w-7 text-orange-500" aria-hidden="true" />
                  </label>
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
            "grid gap-3 rounded-[2rem] border border-white/10 bg-white/[0.08] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.30)] backdrop-blur-xl",
            createOpen ? "ring-1 ring-orange-300/16" : "p-2"
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
            <div className="overflow-hidden rounded-[1.65rem] bg-white text-slate-950 shadow-2xl ring-1 ring-white/70">
              <TripCreateForm mode="mobile-pass" redirectOnSuccess />
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}

type MobileTripsCountriesMapProps = {
  activeYearTrips: Trip[];
  activeYear: string;
  hydrated: boolean;
  onQueryChange: (query: string) => void;
  onYearChange: (year: string) => void;
  query: string;
  years: string[];
};

function MobileTripsCountriesMap({
  activeYearTrips,
  activeYear,
  hydrated,
  onQueryChange,
  onYearChange,
  query,
  years
}: MobileTripsCountriesMapProps) {
  const unifiedMap = useOptionalUnifiedMap();
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const carouselCardRefs = useRef(new Map<string, HTMLButtonElement>());
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const markerTrips = useMemo(() => activeYearTrips.filter(hasTripCoordinates), [activeYearTrips]);
  const tripPins = useMemo(() => markerTrips.map(tripToMapPin), [markerTrips]);
  const globeTripPins = useMemo(() => markerTrips.map(tripToGlobeFlagPin).filter(isGlobeTripPin), [markerTrips]);
  const carouselTrips = useMemo(() => {
    const pinTripIds = new Set(globeTripPins.map((pin) => pin.tripId ?? pin.id));
    return activeYearTrips.filter((trip) => pinTripIds.has(trip.id));
  }, [activeYearTrips, globeTripPins]);
  const selectedCarouselTrips = useMemo(
    () => selectedTripId ? carouselTrips.filter((trip) => trip.id === selectedTripId) : [],
    [carouselTrips, selectedTripId]
  );
  const userLocationPin = unifiedMap?.surfaceState.pins.find((pin) => pin.kind === "user-location") ?? null;
  const selectedPin = unifiedMap?.surfaceState.pins.find((pin) => pin.id === unifiedMap.surfaceState.selectedId) ?? null;

  useEffect(() => {
    unifiedMap?.setPins(tripPins);
  }, [tripPins, unifiedMap?.setPins]);

  useEffect(() => {
    if (!globeTripPins.length) {
      setActiveTripId(null);
      return;
    }

    setActiveTripId((current) => {
      if (!current) return null;
      const currentStillVisible = globeTripPins.some((pin) => (pin.tripId ?? pin.id) === current);
      return currentStillVisible ? current : null;
    });
  }, [globeTripPins]);

  useEffect(() => {
    if (!selectedTripId) return;
    const selectedStillVisible = globeTripPins.some((pin) => (pin.tripId ?? pin.id) === selectedTripId);
    if (!selectedStillVisible) {
      setSelectedTripId(null);
    }
  }, [globeTripPins, selectedTripId]);

  function selectTripOnMap(tripId: string, options: { scrollCarousel?: boolean } = {}) {
    setActiveTripId(tripId);
    unifiedMap?.selectPin(`trip-${tripId}`);

    if (options.scrollCarousel === false) return;

    window.requestAnimationFrame(() => {
      carouselCardRefs.current.get(tripId)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center"
      });
    });
  }

  function handleTripPinSelect(tripId: string) {
    const nextSelectedTripId = selectedTripId === tripId ? null : tripId;
    setSelectedTripId(nextSelectedTripId);

    if (nextSelectedTripId) {
      selectTripOnMap(nextSelectedTripId);
      return;
    }

    setActiveTripId(null);
    unifiedMap?.selectPin(null);
  }

  function handleCarouselScroll() {
    const carousel = carouselRef.current;
    if (!carousel || carouselTrips.length < 2) return;

    const carouselCenter = carousel.scrollLeft + carousel.clientWidth / 2;
    let nearestTripId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const trip of carouselTrips) {
      const card = carouselCardRefs.current.get(trip.id);
      if (!card) continue;

      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(carouselCenter - cardCenter);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestTripId = trip.id;
      }
    }

    if (nearestTripId && nearestTripId !== activeTripId) {
      selectTripOnMap(nearestTripId, { scrollCarousel: false });
    }
  }

  return (
    <section
      className="relative isolate -mx-3 -mt-4 min-h-[100dvh] overflow-hidden bg-black text-white sm:-mx-6 sm:-mt-6 lg:hidden"
      data-camera-command={unifiedMap?.surfaceState.cameraCommand?.type ?? undefined}
      data-hydrated={hydrated ? "true" : "false"}
      data-map-mode={unifiedMap?.surfaceState.mode}
      data-globe-trip-pin-countries={globeTripPins.map((pin) => pin.countryCode).join(",")}
      data-globe-trip-pin-count={String(globeTripPins.length)}
      data-globe-trip-pin-ids={globeTripPins.map((pin) => pin.tripId ?? pin.id).join(",")}
      data-selected-map-id={unifiedMap?.surfaceState.selectedId ?? undefined}
      data-selected-pin-country-code={selectedPin?.countryCode ?? undefined}
      data-selected-pin-label={selectedPin?.label ?? undefined}
      data-testid="mobile-trips-country-map-screen"
      data-user-pin-country-code={userLocationPin?.countryCode ?? undefined}
      data-user-pin-label={userLocationPin?.label ?? undefined}
      data-user-pin-latitude={userLocationPin ? userLocationPin.coordinate.lat.toFixed(5) : undefined}
      data-user-pin-longitude={userLocationPin ? userLocationPin.coordinate.lng.toFixed(5) : undefined}
      data-user-pin-source={unifiedMap?.surfaceState.location.coordinate ? unifiedMap.surfaceState.location.source : undefined}
    >
      <MobileTripsGlobeCanvas
        activeTripId={activeTripId}
        onTripPinSelect={handleTripPinSelect}
        tripPins={globeTripPins}
      />

      <div className="absolute right-4 top-[calc(4.5rem+env(safe-area-inset-top))] z-20 overflow-hidden rounded-[1.45rem] border border-white/10 bg-black/86 text-orange-400 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <Link
          aria-label="Open trip list"
          className="grid h-12 w-12 place-items-center border-b border-white/10 transition hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
          href={`${dashboardActionRoutes.trips.list}?view=list`}
        >
          <List className="h-5 w-5" aria-hidden="true" />
        </Link>
        <button
          aria-label="Locate trips"
          className="grid h-12 w-12 place-items-center transition hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
          onClick={() => {
            void unifiedMap?.locateUser();
          }}
          type="button"
        >
          <LocateFixed className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <MobileTripsMapCarousel
        activeTripId={activeTripId}
        carouselRef={carouselRef}
        cardRefs={carouselCardRefs}
        onScroll={handleCarouselScroll}
        onSelectTrip={(tripId) => selectTripOnMap(tripId, { scrollCarousel: false })}
        trips={selectedCarouselTrips}
      />

      <MobileTripsOverviewPanel
        activeYear={activeYear}
        hydrated={hydrated}
        onQueryChange={onQueryChange}
        onYearChange={onYearChange}
        query={query}
        years={years}
      />
    </section>
  );
}

function MobileTripsMapCarousel({
  activeTripId,
  carouselRef,
  cardRefs,
  onScroll,
  onSelectTrip,
  trips
}: {
  activeTripId: string | null;
  carouselRef: RefObject<HTMLDivElement | null>;
  cardRefs: MutableRefObject<Map<string, HTMLButtonElement>>;
  onScroll: () => void;
  onSelectTrip: (tripId: string) => void;
  trips: Trip[];
}) {
  if (!trips.length) {
    return null;
  }

  return (
    <div className="absolute inset-x-0 bottom-[calc(13.4rem+env(safe-area-inset-bottom))] z-20">
      <div
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1"
        data-testid="mobile-trips-overview-carousel"
        onScroll={onScroll}
        ref={carouselRef}
      >
        {trips.map((trip) => {
          const isActive = activeTripId === trip.id;
          return (
            <button
              className={cn(
                "min-h-[7.25rem] w-[76vw] max-w-[21rem] shrink-0 snap-center rounded-[1.45rem] border p-4 text-left shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-xl transition focus:outline-none focus:ring-4 focus:ring-orange-400/25",
                isActive
                  ? "border-orange-400/70 bg-black/88 text-white"
                  : "border-white/12 bg-black/62 text-white/82"
              )}
              data-active={isActive ? "true" : "false"}
              data-testid="mobile-trips-overview-card"
              data-trip-id={trip.id}
              key={trip.id}
              onClick={() => onSelectTrip(trip.id)}
              ref={(node) => {
                if (node) {
                  cardRefs.current.set(trip.id, node);
                } else {
                  cardRefs.current.delete(trip.id);
                }
              }}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[1.35rem] font-black leading-tight tracking-tight text-white">
                    {destinationMapLabel(trip)}
                  </p>
                  <p className="mt-1 truncate text-sm font-bold text-white/58">
                    {trip.destination}
                  </p>
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-500/18 text-lg ring-1 ring-orange-400/20">
                  {countryCodeToFlag(countryCodeFromDestinationText(trip.destination)) ?? "•"}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-orange-300">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                <span className="truncate">{trip.dateRange || tripStatusLabel(trip)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MobileTripsOverviewPanel({
  activeYear,
  hydrated,
  onQueryChange,
  onYearChange,
  query,
  years
}: {
  activeYear: string;
  hydrated: boolean;
  onQueryChange: (query: string) => void;
  onYearChange: (year: string) => void;
  query: string;
  years: string[];
}) {
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 rounded-t-[2rem] bg-black/94 px-5 pb-[calc(1.15rem+env(safe-area-inset-bottom))] pt-4 text-white shadow-[0_-18px_64px_rgba(0,0,0,0.46)] ring-1 ring-white/8 backdrop-blur-2xl"
      data-testid="mobile-country-sheet"
    >
      <div
        className="mx-auto grid w-full max-w-[31rem] gap-4"
        data-testid="mobile-trips-overview-controls"
      >
        <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3">
          <Link
            aria-label="Trip settings"
            className="grid h-11 w-11 place-items-center rounded-full bg-orange-500/16 text-orange-400 ring-1 ring-orange-400/10 transition hover:bg-orange-500/22 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
            href={dashboardActionRoutes.settings.account}
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </Link>
          <h1 className="truncate text-center text-[1.65rem] font-black tracking-tight text-white">
            My Trips
          </h1>
          <div className="flex items-center justify-end gap-2">
            <Link
              aria-label="Open travel stats"
              className="grid h-11 w-11 place-items-center rounded-full bg-orange-500/16 text-orange-400 ring-1 ring-orange-400/10 transition hover:bg-orange-500/22 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
              data-testid="mobile-trips-stats-link"
              href={dashboardActionRoutes.trips.stats}
            >
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              aria-disabled={!hydrated}
              aria-label="Create trip"
              className={cn(
                "grid h-11 w-11 place-items-center rounded-full bg-orange-500/18 text-orange-400 ring-1 ring-orange-400/10 transition hover:bg-orange-500/24 focus:outline-none focus:ring-4 focus:ring-orange-400/20",
                !hydrated && "pointer-events-none opacity-60"
              )}
              href="/dashboard/trips?view=list#new-trip"
            >
              <Plus className="h-6 w-6" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <label className="relative block">
          <span className="sr-only">Search for trips</span>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/42"
            aria-hidden="true"
          />
          <input
            className="h-12 w-full rounded-full border border-white/[0.06] bg-white/[0.09] pl-12 pr-4 text-base font-semibold text-white outline-none placeholder:text-white/38 focus:border-orange-300/45 focus:ring-4 focus:ring-orange-400/15"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search for trips"
            type="search"
            value={query}
          />
        </label>

        <label className="relative inline-flex w-fit items-center">
          <span className="sr-only">Trip year</span>
          <select
            className="h-12 appearance-none rounded-full border border-transparent bg-transparent py-0 pl-0 pr-9 text-4xl font-black leading-none tracking-tight text-orange-500 outline-none focus:ring-4 focus:ring-orange-400/20"
            data-testid="mobile-trips-overview-year-select"
            onChange={(event) => onYearChange(event.target.value)}
            value={activeYear}
          >
            {years.length ? years.map((year) => (
              <option className="bg-black text-white" key={year} value={year}>
                {year}
              </option>
            )) : (
              <option className="bg-black text-white" value={activeYear}>
                {activeYear}
              </option>
            )}
          </select>
          <ChevronDown className="pointer-events-none ml-[-2.1rem] h-7 w-7 text-orange-500" aria-hidden="true" />
        </label>
      </div>
    </div>
  );
}

function MobileTripsGlobeCanvas({
  activeTripId,
  onTripPinSelect,
  tripPins
}: {
  activeTripId: string | null;
  onTripPinSelect: (tripId: string) => void;
  tripPins: AlmidyLaunchGlobeTripPin[];
}) {
  const mapInstanceKey = `trips-globe-${tripPins.length}-${tripPins
    .map((pin) => [
      pin.tripId ?? pin.id,
      pin.countryCode,
      Number(pin.lat).toFixed(5),
      Number(pin.lng).toFixed(5)
    ].join(":"))
    .join("|")}`;

  if (!tripPins.length) {
    return (
      <div
        className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden bg-[#090e14]"
        data-map-instance-key="trips-globe-empty"
        data-map-system="almidy-google-maps-3d"
        data-testid="mobile-country-map-canvas"
      >
        <span className="text-sm font-semibold text-white/42">Loading trips...</span>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden bg-black"
      data-map-instance-key={mapInstanceKey}
      data-map-system="almidy-google-maps-3d"
      data-testid="mobile-country-map-canvas"
    >
      <CustomGlobeRenderer
        activeTripId={activeTripId}
        className="absolute inset-0 h-full min-h-[100dvh] w-full"
        defaultFocusWhenEmpty
        mapInstanceKey={mapInstanceKey}
        onTripPinSelect={onTripPinSelect}
        renderTripPins
        showCountryPin={false}
        tripPins={tripPins}
        useLocationFocus={false}
      />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.24),rgba(4,10,20,0.42)_35%,rgba(0,0,0,0.72)_100%)]" />
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-[#030916]/30 mix-blend-multiply"
        aria-hidden="true"
      />
    </div>
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

function MobileTripsBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0"
      data-testid="mobile-trips-wallet-background"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(20,184,166,0.18),transparent_28%),radial-gradient(circle_at_88%_12%,rgba(37,99,235,0.22),transparent_30%),linear-gradient(180deg,#020617,#000_34%,#000)]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(15,23,42,0.32),transparent)]" />
      <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(90deg,rgba(20,184,166,0.12),rgba(37,99,235,0.18),rgba(249,115,22,0.06))]" />
    </div>
  );
}

function NoTripsCard({ disabled, onCreate }: { disabled: boolean; onCreate: () => void }) {
  return (
    <article
      className="relative isolate min-h-[26rem] overflow-hidden rounded-[2.25rem] bg-[radial-gradient(circle_at_18%_8%,rgba(255,255,255,0.30),transparent_24%),radial-gradient(circle_at_78%_12%,rgba(249,115,22,0.24),transparent_26%),linear-gradient(145deg,#020617,#172554_48%,#0f766e)] p-5 text-white shadow-[0_32px_100px_rgba(0,0,0,0.52)]"
      data-testid="mobile-premium-first-trip-card"
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.02),rgba(2,6,23,0.28)_42%,rgba(2,6,23,0.88))]" />
      <div className="absolute -right-12 top-10 h-44 w-44 rounded-full border border-white/12 bg-white/6 shadow-[0_0_70px_rgba(96,165,250,0.24)]" />
      <div className="absolute left-5 top-5 flex items-center gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/16 text-orange-200 ring-1 ring-white/18 backdrop-blur">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="rounded-full bg-black/24 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-white/78 ring-1 ring-white/12 backdrop-blur">
          First Trip Pass
        </span>
      </div>

      <div className="relative flex min-h-[23rem] flex-col justify-end">
        <div className="mb-5 grid gap-2">
          <FirstTripStep icon={<MapPinned className="h-4 w-4" aria-hidden="true" />} label="Pick a destination" />
          <FirstTripStep icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />} label="Add dates when ready" />
          <FirstTripStep icon={<Sparkles className="h-4 w-4" aria-hidden="true" />} label="Open a visual wallet" />
        </div>
        <p className="text-sm font-bold text-orange-200/90">Your Almidy starts here</p>
        <h2 className="mt-2 text-4xl font-black leading-none tracking-tight">
          Create your first trip
        </h2>
        <p className="mt-3 max-w-sm text-sm font-semibold leading-6 text-white/[0.74]">
          Start with a city and Almidy will shape it into a premium Trip Pass with map-ready details.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-slate-950 shadow-xl transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-white/20 disabled:cursor-wait disabled:opacity-60"
            disabled={disabled}
            onClick={onCreate}
            type="button"
          >
            Create trip
          </button>
          <span className="text-xs font-black uppercase tracking-[0.16em] text-white/50">
            No setup required
          </span>
        </div>
      </div>
    </article>
  );
}

function FirstTripStep({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex w-fit items-center gap-2 rounded-full bg-white/[0.10] py-1 pl-1 pr-3 text-xs font-black text-white/82 ring-1 ring-white/12 backdrop-blur">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-white/14 text-orange-200">
        {icon}
      </span>
      {label}
    </div>
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

function destinationMapLabel(trip: Trip) {
  const destination = trip.destination.replace(/\s*,\s*(United States|USA|US|Canada|Japan|Spain)$/i, "");
  return destination.split(",")[0]?.trim() || trip.name;
}

function tripToMapPin(trip: Trip): AlmidyMapPin {
  return buildTripPin({
    coordinate: { lat: trip.destinationLat!, lng: trip.destinationLng! },
    destination: trip.destination,
    href: trip.href,
    id: `trip-${trip.id}`,
    imageAlt: trip.imageAlt,
    imageAttribution: trip.imageAttribution,
    imageUrl: trip.imageUrl,
    label: destinationMapLabel(trip),
    subtitle: trip.name,
    tripId: trip.id
  });
}

function tripToGlobeFlagPin(trip: Trip): AlmidyLaunchGlobeTripPin | null {
  const countryCode = countryCodeFromDestinationText(trip.destination);
  const flag = countryCodeToFlag(countryCode);
  const coordinate = tripDestinationCoordinate(trip);

  if (!countryCode || !flag || !coordinate) {
    return null;
  }

  return {
    countryCode,
    flag,
    href: trip.href,
    id: `trip-country-${trip.id}`,
    label: destinationMapLabel(trip),
    lat: coordinate.lat,
    lng: coordinate.lng,
    subtitle: trip.name,
    tripId: trip.id
  };
}

function tripDestinationCoordinate(trip: Trip) {
  if (!hasTripCoordinates(trip)) {
    return null;
  }

  return {
    lat: trip.destinationLat,
    lng: trip.destinationLng
  };
}

function isGlobeTripPin(pin: AlmidyLaunchGlobeTripPin | null): pin is AlmidyLaunchGlobeTripPin {
  return Boolean(pin);
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
