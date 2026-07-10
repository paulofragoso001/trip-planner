"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BedDouble, CalendarPlus, MapPin, MoreHorizontal, Plane, Route, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { TripOverviewData } from "@/app/dashboard/trips/[tripId]/overview-loader";
import { MobileFlightRouteCard } from "@/components/trip/mobile-flight-route-card";
import TripOverviewPage from "@/components/trip/trip-overview-page";

export type MobileTripsOverviewFocus = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  tripId: string;
  typeLabel?: string | null;
};

export interface MobileTripsWalletSheetTrip {
  id: string;
  city: string;
  destination_name: string;
  countryCode: string | null;
  date_range: string;
  endDate?: string | null;
  href?: string;
  image?: string | null;
  imageAlt?: string | null;
  name?: string;
  startDate?: string | null;
  statusText: string;
  lat: number | null;
  lng: number | null;
}

export type TripsOverviewSheetState = "collapsed" | "small" | "expanded";

interface WalletSheetProps {
  currentYear: string;
  initialOverviewData?: TripOverviewData | null;
  initialSelectedTripId?: string | null;
  initialSheetState?: TripsOverviewSheetState;
  onOverviewFocusChange?: (focus: MobileTripsOverviewFocus | null) => void;
  onQueryChange?: (query: string) => void;
  onYearChange?: (year: string) => void;
  onOpenSettings?: () => void;
  onOpenStats?: () => void;
  query?: string;
  settingsHref?: string;
  statsHref?: string;
  trips?: MobileTripsWalletSheetTrip[];
  years?: string[];
}

const sheetHeights: Record<TripsOverviewSheetState, number | string> = {
  collapsed: "calc(14.5rem + env(safe-area-inset-bottom))",
  small: "min(52dvh, calc(100dvh - env(safe-area-inset-top) - 1rem))",
  expanded: "calc(100dvh - env(safe-area-inset-top) - 0.75rem)"
};

function tripNeedsConfiguration(trip: MobileTripsWalletSheetTrip) {
  const destinationName = trip.destination_name?.trim().toLowerCase();

  return (
    !destinationName ||
    destinationName === "destination not set" ||
    trip.lat === null ||
    trip.lng === null
  );
}

function tripCardHref(trip: MobileTripsWalletSheetTrip) {
  const tripId = encodeURIComponent(trip.id);

  if (tripNeedsConfiguration(trip)) {
    return `/dashboard/trips?view=list&edit=${tripId}#new-trip`;
  }

  return trip.href || `/dashboard/trips/${tripId}`;
}

export default function MobileTripsWalletSheet({
  currentYear,
  initialOverviewData = null,
  initialSelectedTripId = null,
  initialSheetState = "collapsed",
  onOverviewFocusChange,
  onOpenSettings,
  query,
  settingsHref,
  trips = []
}: WalletSheetProps) {
  const [sheetState, setSheetState] = useState<TripsOverviewSheetState>(initialSheetState);
  const [overviewData, setOverviewData] = useState<TripOverviewData | null>(initialOverviewData);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overviewLoadingTripId, setOverviewLoadingTripId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const resolvedQuery = query ?? "";
  const isCollapsed = sheetState === "collapsed";
  const isSmall = sheetState === "small";
  const isExpanded = sheetState === "expanded";

  const filteredTrips = useMemo(() => {
    const normalizedQuery = resolvedQuery.trim().toLowerCase();
    if (!normalizedQuery) return trips;

    return trips.filter((trip) =>
      [
        trip.city,
        trip.destination_name,
        trip.countryCode,
        trip.date_range,
        trip.statusText
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [resolvedQuery, trips]);
  const activeTrip =
    (initialSelectedTripId
      ? filteredTrips.find((trip) => trip.id === initialSelectedTripId) ||
        trips.find((trip) => trip.id === initialSelectedTripId)
      : null) ||
    filteredTrips[0] ||
    trips[0] ||
    null;
  const showEmbeddedOverview = Boolean(isExpanded && activeTrip);
  const shouldLoadOverview = Boolean(activeTrip);

  useEffect(() => {
    if (!shouldLoadOverview || !activeTrip) {
      return;
    }

    if (overviewData?.tripId === activeTrip.id) {
      return;
    }

    const controller = new AbortController();
    setOverviewError(null);
    setOverviewLoadingTripId(activeTrip.id);

    fetch(`/api/trips/${encodeURIComponent(activeTrip.id)}/overview`, {
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Trip overview failed to load");
        }
        return response.json() as Promise<TripOverviewData>;
      })
      .then((data) => {
        setOverviewData(data);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setOverviewError("Could not load the trip overview.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setOverviewLoadingTripId(null);
        }
      });

    return () => controller.abort();
  }, [activeTrip, overviewData?.tripId, shouldLoadOverview]);

  useEffect(() => {
    if (!onOverviewFocusChange) {
      return;
    }

    if (!activeTrip) {
      onOverviewFocusChange(null);
      return;
    }

    if (overviewData?.tripId !== activeTrip.id) {
      return;
    }

    const firstMappedItem = overviewData.mapPreviewItems.find((item) =>
      Number.isFinite(item.lat) && Number.isFinite(item.lng)
    );

    if (!firstMappedItem) {
      onOverviewFocusChange(null);
      return;
    }

    onOverviewFocusChange({
      id: `activity-${firstMappedItem.id}`,
      label: firstMappedItem.title,
      lat: firstMappedItem.lat,
      lng: firstMappedItem.lng,
      tripId: activeTrip.id,
      typeLabel: firstMappedItem.category
    });
  }, [activeTrip, onOverviewFocusChange, overviewData]);

  function closeModalState() {
    setSheetState("collapsed");
  }

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: { offset: { y: number }; velocity: { y: number } }) {
    if (info.offset.y < -42 || info.velocity.y < -360) {
      setSheetState((current) => (current === "collapsed" ? "small" : "expanded"));
      return;
    }

    if (info.offset.y > 42 || info.velocity.y > 360) {
      setSheetState((current) => (current === "expanded" ? "small" : "collapsed"));
    }
  }

  function cycleSheetState() {
    setSheetState((current) => {
      if (current === "collapsed") return "small";
      if (current === "small") return "expanded";
      return "collapsed";
    });
  }

  function openSearchState() {
    setSheetState((current) => (current === "expanded" ? "expanded" : "small"));
  }

  return (
    <>
      <AnimatePresence>
        {isExpanded ? (
          <motion.button
            aria-label="Close trip sheet"
            className="fixed inset-0 z-40 bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={closeModalState}
            type="button"
          />
        ) : null}
      </AnimatePresence>

      <motion.aside
        aria-label="My Trips wallet sheet"
        animate={{
          height: sheetHeights[sheetState]
        }}
        className="native-map-web-interactive fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] flex-col overflow-hidden rounded-t-[28px] border-t border-white/10 bg-[#4d4942]/92 text-white shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
        data-sheet-state={sheetState}
        data-testid="mobile-country-sheet"
        drag="y"
        dragConstraints={{ bottom: 0, top: 0 }}
        dragElastic={0.08}
        onDragEnd={handleDragEnd}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", damping: 25, stiffness: 220 }}
      >
        <button
          aria-label={isExpanded ? "Collapse trips sheet" : "Expand trips sheet"}
          className="mx-auto my-3 h-5 w-16 shrink-0 touch-manipulation rounded-full focus:outline-none focus:ring-4 focus:ring-orange-400/20"
          onClick={cycleSheetState}
          type="button"
        >
          <span className="mx-auto block h-1 w-12 rounded-full bg-zinc-700/60" />
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key="wallet-list"
            animate={{ opacity: 1, y: 0 }}
            className={
              isExpanded
                ? "flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
                : isCollapsed
                  ? "flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-[calc(0.85rem+env(safe-area-inset-bottom))]"
                  : "flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
            }
            data-testid="mobile-trips-overview-controls"
            exit={{ opacity: 0, y: -10 }}
            initial={{ opacity: 0, y: 10 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
          >
            {showEmbeddedOverview && activeTrip ? (
              <EmbeddedTripOverview
                error={overviewError}
                isLoading={overviewLoadingTripId === activeTrip.id}
                overview={overviewData?.tripId === activeTrip.id ? overviewData : null}
                trip={activeTrip}
              />
            ) : (
              <>
                <div
                  className={
                    isCollapsed
                      ? "mb-3 grid grid-cols-[auto_1fr_auto] items-start gap-3"
                      : "mb-5 grid grid-cols-[auto_1fr_auto] items-start gap-3"
                  }
                >
                  <div className="flex items-center gap-2">
                    {activeTrip ? (
                      <Link
                        aria-label={`Open ${activeTrip.city || "trip"} overview`}
                        className="grid h-12 w-12 place-items-center rounded-full bg-white/70 text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition hover:bg-white/80 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                        href={tripCardHref(activeTrip)}
                      >
                        <MoreHorizontal className="h-7 w-7" aria-hidden="true" />
                      </Link>
                    ) : settingsHref ? (
                      <Link
                        aria-label="Trip settings"
                        className="grid h-12 w-12 place-items-center rounded-full bg-white/70 text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition hover:bg-white/80 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                        href={settingsHref}
                      >
                        <MoreHorizontal className="h-7 w-7" aria-hidden="true" />
                      </Link>
                    ) : (
                      <button
                        aria-label="Trip settings"
                        className="grid h-12 w-12 place-items-center rounded-full bg-white/70 text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition hover:bg-white/80 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                        onClick={onOpenSettings}
                        type="button"
                      >
                        <MoreHorizontal className="h-7 w-7" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      aria-label="Search trips"
                      className="grid h-12 w-12 place-items-center rounded-full bg-white/70 text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition hover:bg-white/80 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                      onClick={openSearchState}
                      type="button"
                    >
                      <Search className="h-7 w-7" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="min-w-0 pt-1 text-center">
                    <h2 className={isCollapsed ? "truncate text-[1.35rem] font-black leading-tight text-white" : "truncate text-[1.6rem] font-black leading-tight text-white"}>
                      {activeTrip?.city || "My Trips"}
                    </h2>
                    <p className={isCollapsed ? "truncate text-sm font-semibold leading-tight text-white/62" : "truncate text-base font-semibold leading-tight text-white/62"}>
                      {activeTrip?.date_range || currentYear}
                    </p>
                  </div>

                  <button
                    aria-label="Collapse trips sheet"
                    className="grid h-12 w-12 place-items-center rounded-full bg-white/70 text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition hover:bg-white/80 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                    onClick={closeModalState}
                    type="button"
                  >
                    <X className="h-8 w-8" aria-hidden="true" />
                  </button>
                </div>

                {activeTrip ? <TripShortcutRail compact={isCollapsed} trip={activeTrip} /> : null}

                {isSmall && activeTrip ? (
                  <SmallTripOverview
                    isLoading={overviewLoadingTripId === activeTrip.id}
                    overview={overviewData?.tripId === activeTrip.id ? overviewData : null}
                    trip={activeTrip}
                  />
                ) : !activeTrip ? (
                  <div className="grid min-h-0 flex-1 place-items-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/54 p-5 text-center">
                    <div>
                      <MapPin className="mx-auto h-7 w-7 text-zinc-600" aria-hidden="true" />
                      <p className="mt-3 text-sm font-bold text-zinc-300">No trips for {currentYear}</p>
                      <p className="mt-1 text-xs font-medium text-zinc-500">
                        Create a trip to pin a country flag on the globe.
                      </p>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.aside>
    </>
  );
}

function EmbeddedTripOverview({
  error,
  isLoading,
  overview,
  trip
}: {
  error: string | null;
  isLoading: boolean;
  overview: TripOverviewData | null;
  trip: MobileTripsWalletSheetTrip;
}) {
  if (overview) {
    return (
      <div className="-mx-5 -mt-3 min-h-0 flex-1 overflow-y-auto rounded-t-[1.65rem] bg-[#05060a]">
        <TripOverviewPage {...overview} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid min-h-0 flex-1 content-start gap-4">
        <div className="rounded-[1.35rem] border border-amber-300/20 bg-amber-300/10 p-4 text-sm font-bold leading-6 text-amber-50">
          {error}
        </div>
        <Link
          className="rounded-full bg-white px-5 py-3 text-center text-sm font-black text-black"
          href={tripCardHref(trip)}
        >
          Open trip overview
        </Link>
      </div>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 place-items-center rounded-[1.65rem] bg-black/24 p-6 text-center">
      <div>
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        <p className="mt-4 text-sm font-black text-white">
          {isLoading ? "Loading trip overview..." : "Preparing trip overview..."}
        </p>
      </div>
    </div>
  );
}

function SmallTripOverview({
  isLoading,
  overview,
  trip
}: {
  isLoading: boolean;
  overview: TripOverviewData | null;
  trip: MobileTripsWalletSheetTrip;
}) {
  const primaryItem = overview?.itineraryPreview[0] ?? null;

  if (primaryItem && overview) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto pb-2" data-testid="mobile-trips-small-overview">
        <Link
          aria-label={`Open ${trip.city || "trip"} itinerary`}
          className="block rounded-[28px] bg-white p-5 text-black shadow-[0_18px_45px_rgba(0,0,0,0.22)] transition active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-orange-400/20"
          href={tripSectionHref(trip, "timeline")}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange-100 text-orange-500">
                {iconForSmallOverviewItem(primaryItem.typeLabel)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xl font-black">Itinerary</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-black/48">
                  {overview.dateRange}
                </p>
              </div>
            </div>
            <span className="shrink-0 pt-1 text-sm font-black text-orange-500">Add</span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 rounded-[20px] bg-black/[0.045] p-4">
            <div className="min-w-0">
              <p className="truncate text-lg font-black">{primaryItem.title}</p>
              <p className="mt-1 truncate text-sm font-semibold text-black/46">
                {primaryItem.location}
              </p>
            </div>
            <span className="shrink-0 text-base font-semibold text-black/42">
              {primaryItem.timeLabel}
            </span>
          </div>
        </Link>
      </div>
    );
  }

  if (overview?.flightPreview) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto pb-2" data-testid="mobile-trips-small-overview">
        <MobileFlightRouteCard flight={overview.flightPreview} tripId={trip.id} />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-2" data-testid="mobile-trips-small-overview">
      <Link
        aria-label={`Open ${trip.city || "trip"} itinerary`}
        className="block rounded-[28px] bg-white p-5 text-black shadow-[0_18px_45px_rgba(0,0,0,0.22)] transition active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-orange-400/20"
        href={tripSectionHref(trip, "timeline")}
      >
        <div className="flex items-center justify-between gap-4">
          <span className="text-xl font-black">Itinerary</span>
          <span className="text-sm font-black text-orange-500">{isLoading ? "Loading" : "Add"}</span>
        </div>
        <p className="mt-3 text-base font-semibold text-black/50">
          {isLoading ? "Preparing trip overview..." : "Start organizing your itinerary"}
        </p>
      </Link>
    </div>
  );
}

function iconForSmallOverviewItem(typeLabel: string) {
  const normalized = typeLabel.toLowerCase();
  if (/flight|airport|plane/.test(normalized)) return <Plane className="h-6 w-6" aria-hidden="true" />;
  if (/hotel|lodging|stay/.test(normalized)) return <BedDouble className="h-6 w-6" aria-hidden="true" />;
  if (/route|transfer|drive|train|bus/.test(normalized)) return <Route className="h-6 w-6" aria-hidden="true" />;
  if (/place|restaurant|activity|attraction/.test(normalized)) return <MapPin className="h-6 w-6" aria-hidden="true" />;
  return <CalendarPlus className="h-6 w-6" aria-hidden="true" />;
}

function TripShortcutRail({ compact = false, trip }: { compact?: boolean; trip: MobileTripsWalletSheetTrip }) {
  const shortcuts = [
    {
      href: tripSectionHref(trip, "timeline"),
      icon: <CalendarPlus className="h-8 w-8" aria-hidden="true" />,
      label: "New Activity"
    },
    {
      href: tripSectionHref(trip, "timeline"),
      icon: <Plane className="h-8 w-8" aria-hidden="true" />,
      label: "Flights"
    },
    {
      href: tripCardHref(trip),
      icon: <BedDouble className="h-8 w-8" aria-hidden="true" />,
      label: "Stays"
    },
    {
      href: tripSectionHref(trip, "ideas"),
      icon: <MapPin className="h-8 w-8" aria-hidden="true" />,
      label: "Places"
    },
    {
      href: tripSectionHref(trip, "map"),
      icon: <Route className="h-8 w-8" aria-hidden="true" />,
      label: "Routes"
    }
  ];

  return (
    <nav
      aria-label={`${trip.city || "Trip"} quick actions`}
      className={compact ? "no-scrollbar -mx-5 mb-0 flex snap-x gap-3 overflow-x-auto px-5 pb-1" : "no-scrollbar -mx-5 mb-4 flex snap-x gap-4 overflow-x-auto px-5 pb-1"}
      data-testid="mobile-trips-shortcut-rail"
    >
      {shortcuts.map((shortcut) => (
        <Link
          aria-label={shortcut.label}
          className={compact ? "grid min-w-[4.35rem] snap-start gap-1.5 text-center text-white/70 transition hover:text-white focus:outline-none focus:ring-4 focus:ring-orange-400/20" : "grid min-w-[5.25rem] snap-start gap-2 text-center text-white/70 transition hover:text-white focus:outline-none focus:ring-4 focus:ring-orange-400/20"}
          href={shortcut.href}
          key={shortcut.label}
        >
          <span className={compact ? "grid h-14 w-14 place-items-center rounded-full bg-white/24 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] [&_svg]:h-7 [&_svg]:w-7" : "grid h-[4.65rem] w-[4.65rem] place-items-center rounded-full bg-white/24 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"}>
            {shortcut.icon}
          </span>
          <span className={compact ? "text-xs font-semibold leading-tight" : "text-sm font-semibold leading-tight"}>{shortcut.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function tripSectionHref(
  trip: MobileTripsWalletSheetTrip,
  section: "budget" | "documents" | "ideas" | "map" | "timeline"
) {
  if (tripNeedsConfiguration(trip)) {
    return tripCardHref(trip);
  }

  return `${trip.href || `/dashboard/trips/${encodeURIComponent(trip.id)}`}/${section}`;
}
