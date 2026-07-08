"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BedDouble, CalendarPlus, ChevronDown, FileText, MapPin, MoreHorizontal, Plane, Route, Search, WalletCards, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { TripOverviewData } from "@/app/dashboard/trips/[tripId]/overview-loader";
import TripOverviewPage from "@/components/trip/trip-overview-page";

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

interface WalletSheetProps {
  currentYear: string;
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

type TripsOverviewSheetState = "collapsed" | "small" | "expanded";

const sheetHeights: Record<TripsOverviewSheetState, number | string> = {
  collapsed: "calc(16.75rem + env(safe-area-inset-bottom))",
  small: "min(56dvh, calc(100dvh - env(safe-area-inset-top) - 1rem))",
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
  onQueryChange,
  onYearChange,
  onOpenSettings,
  onOpenStats,
  query,
  settingsHref,
  statsHref,
  trips = [],
  years = [currentYear]
}: WalletSheetProps) {
  const [sheetState, setSheetState] = useState<TripsOverviewSheetState>("collapsed");
  const [searchQuery, setSearchQuery] = useState("");
  const [overviewData, setOverviewData] = useState<TripOverviewData | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overviewLoadingTripId, setOverviewLoadingTripId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const resolvedQuery = query ?? searchQuery;
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
  const activeTrip = filteredTrips[0] || trips[0] || null;
  const visibleTrips = filteredTrips;
  const showEmbeddedOverview = Boolean(isExpanded && activeTrip);

  useEffect(() => {
    if (!showEmbeddedOverview || !activeTrip) {
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
  }, [activeTrip, overviewData?.tripId, showEmbeddedOverview]);

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

  function updateSearch(value: string) {
    if (onQueryChange) {
      onQueryChange(value);
      return;
    }

    setSearchQuery(value);
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
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] flex-col overflow-hidden rounded-t-[28px] border-t border-white/10 bg-[#48443d]/90 text-white shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
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
              className={isExpanded ? "flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]" : "flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"}
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
              <div className={isCollapsed ? "mb-3 grid grid-cols-[auto_1fr_auto] items-start gap-3" : "mb-4 grid grid-cols-[auto_1fr_auto] items-start gap-3"}>
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
                  <h2 className="truncate text-[1.35rem] font-black leading-tight text-white">
                    {activeTrip?.city || "My Trips"}
                  </h2>
                  <p className="truncate text-base font-semibold leading-tight text-white/62">
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

              {!isCollapsed ? (
                <label className="relative mb-3 block">
                  <span className="sr-only">Search for trips</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                  <input
                    className="w-full rounded-xl border border-transparent bg-[#1e1e22] py-2.5 pl-9 pr-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-zinc-700"
                    onChange={(event) => updateSearch(event.target.value)}
                    placeholder="Search for trips"
                    type="search"
                    value={resolvedQuery}
                  />
                </label>
              ) : null}

              {!isCollapsed ? (
                <label className="mb-4 inline-grid min-h-11 w-fit grid-cols-[auto_auto] items-center gap-1 rounded-full pr-1">
                  <span className="sr-only">Trip year</span>
                  <select
                    className="h-11 appearance-none rounded-full border border-transparent bg-transparent py-0 pl-0 pr-1 text-xl font-bold leading-none text-[#e67e22] outline-none focus:ring-4 focus:ring-orange-400/20"
                    data-testid="mobile-trips-overview-year-select"
                    onChange={(event) => onYearChange?.(event.target.value)}
                    value={currentYear}
                  >
                    {(years.length ? years : [currentYear]).map((year) => (
                      <option className="bg-black text-white" key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none h-4 w-4 shrink-0 text-[#e67e22]" aria-hidden="true" />
                </label>
              ) : null}

              {isExpanded && activeTrip ? <ExistingOverviewLinks trip={activeTrip} /> : null}

              {!isCollapsed && visibleTrips.length ? (
                <div className={isExpanded ? "grid gap-3 pb-2" : "flex min-h-0 flex-1 snap-x gap-4 overflow-x-auto pb-2"}>
                  {visibleTrips.map((trip) => (
                    <Link
                      aria-label={`Open ${trip.city || "trip"}`}
                      className={isExpanded ? "relative min-h-40 overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-900 transition hover:border-orange-400/35 focus:outline-none focus:ring-4 focus:ring-orange-400/20" : "relative min-w-[280px] snap-center overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-900 transition hover:border-orange-400/35 focus:outline-none focus:ring-4 focus:ring-orange-400/20"}
                      data-testid="mobile-trips-wallet-card"
                      href={tripCardHref(trip)}
                      key={trip.id}
                    >
                      {trip.image ? (
                        <img
                          alt={trip.imageAlt || ""}
                          className="absolute inset-0 h-full w-full object-cover opacity-70"
                          src={trip.image}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(249,115,22,0.24),transparent_28%),linear-gradient(145deg,#172554,#020617_58%,#111827)]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent p-4" />
                      <div className={isExpanded ? "relative flex h-full min-h-40 flex-col justify-end p-4" : isSmall ? "relative flex h-full min-h-48 flex-col justify-end p-4" : "relative flex h-full min-h-32 flex-col justify-end p-4"}>
                        <span className="text-xs font-semibold text-[#e67e22]">{trip.statusText}</span>
                        <h3 className="mt-1 text-xl font-bold text-white">{trip.name || trip.city}</h3>
                        <span className="mt-1 text-xs text-zinc-500">{trip.date_range}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : !isCollapsed ? (
                <div className="grid min-h-0 flex-1 place-items-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/54 p-5 text-center">
                  <div>
                    <MapPin className="mx-auto h-7 w-7 text-zinc-600" aria-hidden="true" />
                    <p className="mt-3 text-sm font-bold text-zinc-300">No trips for {currentYear}</p>
                    <p className="mt-1 text-xs font-medium text-zinc-500">Create a trip to pin a country flag on the globe.</p>
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
      <div className="-mx-5 -mt-3 min-h-0 flex-1 overflow-hidden rounded-t-[1.65rem] bg-[#05060a]">
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
        <ExistingOverviewLinks trip={trip} />
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

function ExistingOverviewLinks({ trip }: { trip: MobileTripsWalletSheetTrip }) {
  const sections = [
    {
      href: tripCardHref(trip),
      icon: <MoreHorizontal className="h-5 w-5" aria-hidden="true" />,
      label: "Overview",
      meta: trip.name || trip.city
    },
    {
      href: tripSectionHref(trip, "timeline"),
      icon: <CalendarPlus className="h-5 w-5" aria-hidden="true" />,
      label: "Itinerary",
      meta: trip.date_range
    },
    {
      href: tripSectionHref(trip, "documents"),
      icon: <FileText className="h-5 w-5" aria-hidden="true" />,
      label: "Documents",
      meta: "Trip documents"
    },
    {
      href: tripSectionHref(trip, "budget"),
      icon: <WalletCards className="h-5 w-5" aria-hidden="true" />,
      label: "Expenses",
      meta: "Trip budget"
    }
  ];

  return (
    <section
      aria-label={`${trip.city || "Trip"} overview sections`}
      className="mb-4 overflow-hidden rounded-[1.6rem] bg-white text-black shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
      data-testid="mobile-trips-existing-overview-links"
    >
      {sections.map((section) => (
        <Link
          className="grid min-h-[4.35rem] grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3 border-b border-black/5 px-4 text-left transition last:border-b-0 hover:bg-orange-50 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
          href={section.href}
          key={section.label}
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-orange-50 text-orange-500">
            {section.icon}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-black">{section.label}</span>
            <span className="mt-0.5 block truncate text-sm font-semibold text-black/45">{section.meta}</span>
          </span>
        </Link>
      ))}
    </section>
  );
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
          className={compact ? "grid min-w-[4.5rem] snap-start gap-1.5 text-center text-white/70 transition hover:text-white focus:outline-none focus:ring-4 focus:ring-orange-400/20" : "grid min-w-[5.25rem] snap-start gap-2 text-center text-white/70 transition hover:text-white focus:outline-none focus:ring-4 focus:ring-orange-400/20"}
          href={shortcut.href}
          key={shortcut.label}
        >
          <span className={compact ? "grid h-16 w-16 place-items-center rounded-full bg-white/24 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] [&_svg]:h-7 [&_svg]:w-7" : "grid h-[4.65rem] w-[4.65rem] place-items-center rounded-full bg-white/24 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"}>
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
