"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BarChart3, Briefcase, ChevronDown, Eye, MapPin, Search, Settings } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export interface MobileTripsWalletSheetTrip {
  id: string;
  city: string;
  destination_name: string;
  countryCode: string | null;
  date_range: string;
  image?: string | null;
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

const collapsedHeight = 250;
const expandedHeight = "92dvh";

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

  return `/dashboard/trips/${tripId}`;
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
  const [isMaximized, setIsMaximized] = useState(false);
  const [isTripMenuOpen, setIsTripMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const reduceMotion = useReducedMotion();
  const resolvedQuery = query ?? searchQuery;

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

  function closeModalState() {
    setIsMaximized(false);
    setIsTripMenuOpen(false);
  }

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: { offset: { y: number }; velocity: { y: number } }) {
    if (info.offset.y < -42 || info.velocity.y < -360) {
      setIsMaximized(true);
      return;
    }

    if (info.offset.y > 42 || info.velocity.y > 360) {
      closeModalState();
    }
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
        {isMaximized ? (
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
          height: isMaximized ? expandedHeight : collapsedHeight
        }}
        className="fixed inset-x-2 bottom-0 z-50 flex flex-col overflow-visible rounded-t-[2rem] bg-white text-slate-950 shadow-[0_-18px_54px_rgba(0,0,0,0.24)] ring-1 ring-black/5 min-[390px]:inset-x-4"
        data-sheet-state={isMaximized ? "expanded" : "collapsed"}
        data-testid="mobile-country-sheet"
        drag="y"
        dragConstraints={{ bottom: 0, top: 0 }}
        dragElastic={0.08}
        onDragEnd={handleDragEnd}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", damping: 25, stiffness: 220 }}
      >
        <button
          aria-label={isMaximized ? "Collapse trips sheet" : "Expand trips sheet"}
          className="mx-auto mt-2 grid h-5 w-24 shrink-0 touch-manipulation place-items-center rounded-full focus:outline-none focus:ring-4 focus:ring-orange-400/20"
          onClick={() => setIsMaximized((current) => !current)}
          type="button"
        >
          <span className="block h-1 w-12 rounded-full bg-slate-300" />
        </button>

        <AnimatePresence mode="wait">
          <motion.div
              key="wallet-list"
              animate={{ opacity: 1, y: 0 }}
              className="relative flex min-h-0 flex-1 flex-col overflow-visible px-5 pb-[calc(1.75rem+env(safe-area-inset-bottom))] pt-3"
              data-testid="mobile-trips-overview-controls"
              exit={{ opacity: 0, y: -10 }}
              initial={{ opacity: 0, y: 10 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
            >
              <div className="relative mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <button
                    aria-expanded={isTripMenuOpen}
                    aria-label="Choose trip collection"
                    className="inline-flex max-w-full items-center gap-2 rounded-2xl text-left text-[2.75rem] font-black leading-none tracking-normal text-black transition focus:outline-none focus:ring-4 focus:ring-orange-300/20"
                    onClick={() => setIsTripMenuOpen((current) => !current)}
                    type="button"
                  >
                    <span className="truncate">My Trips</span>
                    <ChevronDown className="mt-2 h-7 w-7 shrink-0 text-slate-400" aria-hidden="true" />
                  </button>
                  {isTripMenuOpen ? (
                    <div className="absolute -top-[9.5rem] left-0 z-20 w-[min(21rem,calc(100vw-3rem))] overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white/72 p-3 text-slate-950 shadow-[0_18px_46px_rgba(15,23,42,0.22)] backdrop-blur-xl">
                      <button
                        className="grid w-full grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-white/60 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
                        type="button"
                      >
                        <Eye className="mx-auto h-7 w-7 text-black" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-xl font-medium leading-tight text-black">Friends' Trips</span>
                          <span className="mt-1 block text-base font-medium leading-tight text-slate-600">
                            All trips that you didn't travel together.
                          </span>
                        </span>
                      </button>
                      <Link
                        aria-label="Open trip list"
                        className="grid w-full grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 rounded-2xl px-2 py-3 text-left transition hover:bg-white/60 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
                        href="/dashboard/trips?view=list"
                        onClick={() => setIsTripMenuOpen(false)}
                      >
                        <Briefcase className="mx-auto h-7 w-7 text-black" aria-hidden="true" />
                        <span className="block text-xl font-medium leading-tight text-black">My Trips</span>
                      </Link>
                    </div>
                  ) : null}
                </div>
                {settingsHref ? (
                  <Link
                    aria-label="Trip settings"
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-orange-100 text-orange-500 transition hover:bg-orange-200 focus:outline-none focus:ring-4 focus:ring-orange-300/25"
                    href={settingsHref}
                  >
                    <Settings className="h-7 w-7" aria-hidden="true" />
                  </Link>
                ) : (
                  <button
                    aria-label="Trip settings"
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-orange-100 text-orange-500 transition hover:bg-orange-200 focus:outline-none focus:ring-4 focus:ring-orange-300/25"
                    onClick={onOpenSettings}
                    type="button"
                  >
                    <Settings className="h-7 w-7" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className={isMaximized ? "mb-4 flex items-center justify-between gap-3" : "sr-only"}>
                {statsHref ? (
                  <Link
                    aria-label="Open travel stats"
                    className="grid h-10 w-10 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                    data-testid="mobile-trips-stats-link"
                    href={statsHref}
                  >
                    <BarChart3 className="h-5 w-5" aria-hidden="true" />
                  </Link>
                ) : (
                  <button
                    aria-label="Trip stats"
                    className="grid h-10 w-10 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                    onClick={onOpenStats}
                    type="button"
                  >
                    <BarChart3 className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
                <Link
                  aria-label="Create trip"
                  data-testid="mobile-trips-wallet-create-trigger"
                  className="grid h-10 w-10 place-items-center rounded-full bg-orange-100 text-orange-500 transition hover:bg-orange-200 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                  href="/dashboard/trips?view=list#new-trip"
                >
                  <span aria-hidden="true" className="text-2xl leading-none">+</span>
                </Link>
              </div>

              <label className={isMaximized ? "relative mb-3 block" : "sr-only"}>
                <span className="sr-only">Search for trips</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                <input
                  className="w-full rounded-xl border border-transparent bg-slate-100 py-2.5 pl-9 pr-4 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-slate-300"
                  onChange={(event) => updateSearch(event.target.value)}
                  placeholder="Search for trips"
                  type="search"
                  value={resolvedQuery}
                />
              </label>

              <label className={isMaximized ? "mb-4 inline-grid min-h-11 w-fit grid-cols-[auto_auto] items-center gap-1 rounded-full pr-1" : "sr-only"}>
                <span className="sr-only">Trip year</span>
                <select
                  className="h-11 appearance-none rounded-full border border-transparent bg-transparent py-0 pl-0 pr-1 text-xl font-bold leading-none text-orange-500 outline-none focus:ring-4 focus:ring-orange-400/20"
                  data-testid="mobile-trips-overview-year-select"
                  onChange={(event) => onYearChange?.(event.target.value)}
                  value={currentYear}
                >
                  {(years.length ? years : [currentYear]).map((year) => (
                    <option className="bg-white text-slate-950" key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none h-4 w-4 shrink-0 text-orange-500" aria-hidden="true" />
              </label>

              {isMaximized && filteredTrips.length ? (
                <div className="flex min-h-0 flex-1 snap-x gap-4 overflow-x-auto pb-2">
                  {filteredTrips.map((trip) => (
                    <Link
                      aria-label={`Open ${trip.city || "trip"}`}
                      className="relative min-w-[280px] snap-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 transition hover:border-orange-400/35 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                      data-testid="mobile-trips-wallet-card"
                      href={tripCardHref(trip)}
                      key={trip.id}
                    >
                      {trip.image ? (
                        <img
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover opacity-70"
                          src={trip.image}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(249,115,22,0.24),transparent_28%),linear-gradient(145deg,#172554,#020617_58%,#111827)]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent p-4" />
                      <div className="relative flex h-full min-h-52 flex-col justify-end p-4">
                        <span className="text-xs font-semibold text-[#e67e22]">{trip.statusText}</span>
                        <h3 className="mt-1 text-xl font-bold text-white">{trip.city}</h3>
                        <span className="mt-1 text-xs text-zinc-500">{trip.date_range}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : isMaximized ? (
                <div className="grid min-h-0 flex-1 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                  <div>
                    <MapPin className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
                    <p className="mt-3 text-sm font-bold text-slate-700">No trips for {currentYear}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">Create a trip to pin a country flag on the globe.</p>
                  </div>
                </div>
              ) : null}
          </motion.div>
        </AnimatePresence>
      </motion.aside>
    </>
  );
}
