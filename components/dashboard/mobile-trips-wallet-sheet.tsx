"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BarChart3, CalendarDays, ChevronDown, MapPin, Search, Settings, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useAlmidyAction } from "@/hooks/use-wayline-action";

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

type CreatedTripPayload = {
  id: string;
  name: string;
  destination: string;
  destinationLat: null;
  destinationLng: null;
  countryCode: null;
  dateRange: string;
  startDate: string | null;
  endDate: string | null;
  statusText: string;
};

interface WalletSheetProps {
  currentYear: string;
  onAddTrip?: (newTrip: CreatedTripPayload) => void;
  onQueryChange?: (query: string) => void;
  onTripCreated?: () => void;
  onYearChange?: (year: string) => void;
  onOpenSettings?: () => void;
  onOpenStats?: () => void;
  query?: string;
  settingsHref?: string;
  statsHref?: string;
  trips?: MobileTripsWalletSheetTrip[];
  years?: string[];
}

const collapsedHeight = 260;
const expandedHeight = "92dvh";

export default function MobileTripsWalletSheet({
  currentYear,
  onAddTrip,
  onQueryChange,
  onTripCreated,
  onYearChange,
  onOpenSettings,
  onOpenStats,
  query,
  settingsHref,
  statsHref,
  trips = [],
  years = [currentYear]
}: WalletSheetProps) {
  const router = useRouter();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tripName, setTripName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const reduceMotion = useReducedMotion();
  const { isPending, run, state } = useAlmidyAction<{ trip?: { id?: string } }>();
  const resolvedQuery = query ?? searchQuery;
  const canCreate = Boolean(tripName.trim() && destination.trim() && !isPending);

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
    setIsCreating(false);
  }

  function openCreateFlow() {
    setIsMaximized(true);
    setIsCreating(true);
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

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextTripName = tripName.trim();
    const nextDestination = destination.trim();
    if (!nextTripName || !nextDestination) return;
    const normalizedStartDate = normalizeDateField(startDate);
    const normalizedEndDate = normalizeDateField(endDate);

    const result = await run({
      body: {
        budget: 0,
        destination: nextDestination,
        destination_formatted_address: null,
        destination_lat: null,
        destination_lng: null,
        destination_place_id: null,
        destination_provider_metadata: {},
        destination_status: "manual",
        end_date: normalizedEndDate,
        name: nextTripName,
        start_date: normalizedStartDate,
        status: "Planning",
        travel_style: "balanced"
      },
      method: "POST",
      timeoutMs: 30000,
      url: "/api/trips"
    });

    if (result.status !== "success") return;

    onAddTrip?.({
      countryCode: null,
      dateRange: `${normalizedStartDate || "Date pending"} → ${normalizedEndDate || "Date pending"}`,
      destination: nextDestination,
      destinationLat: null,
      destinationLng: null,
      endDate: normalizedEndDate,
      id: result.data?.trip?.id || `trip_${Date.now()}`,
      name: nextTripName,
      startDate: normalizedStartDate,
      statusText: "Location pending"
    });

    setTripName("");
    setDestination("");
    setStartDate("");
    setEndDate("");
    closeModalState();
    onTripCreated?.();
    router.refresh();
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
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-[24px] border-t border-zinc-800/80 bg-[#121214] text-white shadow-[0_-8px_32px_rgba(0,0,0,0.5)]"
        data-sheet-state={isCreating ? "creating" : isMaximized ? "expanded" : "collapsed"}
        data-testid="mobile-country-sheet"
        drag="y"
        dragConstraints={{ bottom: 0, top: 0 }}
        dragElastic={0.08}
        onDragEnd={handleDragEnd}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", damping: 25, stiffness: 220 }}
      >
        <button
          aria-label={isMaximized ? "Collapse trips sheet" : "Expand trips sheet"}
          className="mx-auto my-3 h-5 w-16 shrink-0 touch-manipulation rounded-full focus:outline-none focus:ring-4 focus:ring-orange-400/20"
          onClick={() => setIsMaximized((current) => !current)}
          type="button"
        >
          <span className="mx-auto block h-1 w-12 rounded-full bg-zinc-700/60" />
        </button>

        <AnimatePresence mode="wait">
          {!isCreating ? (
            <motion.div
              key="wallet-list"
              animate={{ opacity: 1, y: 0 }}
              className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-6"
              data-testid="mobile-trips-overview-controls"
              exit={{ opacity: 0, y: -10 }}
              initial={{ opacity: 0, y: 10 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
            >
              <div className="mb-4 flex items-center justify-between">
                {settingsHref ? (
                  <Link
                    aria-label="Trip settings"
                    className="grid h-10 w-10 place-items-center rounded-full text-zinc-400 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                    href={settingsHref}
                  >
                    <Settings className="h-5 w-5" aria-hidden="true" />
                  </Link>
                ) : (
                  <button
                    aria-label="Trip settings"
                    className="grid h-10 w-10 place-items-center rounded-full text-zinc-400 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                    onClick={onOpenSettings}
                    type="button"
                  >
                    <Settings className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
                <h2 className="text-lg font-bold text-white">My Trips</h2>
                <div className="flex items-center gap-3">
                  {statsHref ? (
                    <Link
                      aria-label="Open travel stats"
                      className="grid h-10 w-10 place-items-center rounded-full text-zinc-400 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                      data-testid="mobile-trips-stats-link"
                      href={statsHref}
                    >
                      <BarChart3 className="h-5 w-5" aria-hidden="true" />
                    </Link>
                  ) : (
                    <button
                      aria-label="Trip stats"
                      className="grid h-10 w-10 place-items-center rounded-full text-zinc-400 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                      onClick={onOpenStats}
                      type="button"
                    >
                      <BarChart3 className="h-5 w-5" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    aria-label="Create trip"
                    data-testid="mobile-trips-wallet-create-trigger"
                    className="grid h-10 w-10 place-items-center rounded-full bg-[#3a2010] text-[#e67e22] transition hover:bg-[#4d2b15] focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                    onClick={openCreateFlow}
                    type="button"
                  >
                    <span aria-hidden="true" className="text-2xl leading-none">+</span>
                  </button>
                  <Link className="sr-only" href="/dashboard/trips?view=list#new-trip">
                    Create trip
                  </Link>
                </div>
              </div>

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

              <label className="relative mb-4 inline-flex w-fit items-center">
                <span className="sr-only">Trip year</span>
                <select
                  className="h-10 appearance-none rounded-full border border-transparent bg-transparent py-0 pl-0 pr-8 text-xl font-bold text-[#e67e22] outline-none focus:ring-4 focus:ring-orange-400/20"
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
                <ChevronDown className="pointer-events-none ml-[-1.75rem] h-4 w-4 text-[#e67e22]" aria-hidden="true" />
              </label>

              {filteredTrips.length ? (
                <div className="flex min-h-0 flex-1 snap-x gap-4 overflow-x-auto pb-2">
                  {filteredTrips.map((trip) => (
                    <article
                      className="relative min-w-[280px] snap-center overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-900"
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
                    </article>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-0 flex-1 place-items-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/54 p-5 text-center">
                  <div>
                    <MapPin className="mx-auto h-7 w-7 text-zinc-600" aria-hidden="true" />
                    <p className="mt-3 text-sm font-bold text-zinc-300">No trips for {currentYear}</p>
                    <p className="mt-1 text-xs font-medium text-zinc-500">Create a trip to pin a country flag on the globe.</p>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.form
              key="create-form"
              animate={{ opacity: 1, y: 0 }}
              className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6"
              exit={{ opacity: 0, y: 15 }}
              initial={{ opacity: 0, y: 15 }}
              onSubmit={handleFormSubmit}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
            >
              <div className="mb-5 flex items-center justify-between border-b border-zinc-800/60 pb-3">
                <button
                  className="text-sm font-semibold text-[#e67e22] transition hover:opacity-80 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                  onClick={() => setIsCreating(false)}
                  type="button"
                >
                  Cancel
                </button>
                <div className="text-center">
                  <h3 className="text-base font-bold text-white">Create Trip</h3>
                  <p className="mt-0.5 text-[10px] text-zinc-500">Add details for your upcoming {currentYear} wallet.</p>
                </div>
                <button
                  className="rounded-full bg-[#e67e22] px-4 py-1.5 text-xs font-bold text-white transition disabled:opacity-40 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                  disabled={!canCreate}
                  type="submit"
                >
                  {isPending ? "Creating..." : "Create"}
                </button>
              </div>

              <div className="space-y-4">
                <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[#1e1e24]">
                  <label className="block border-b border-zinc-800/60 p-3">
                    <span className="mb-1 block text-[9px] font-bold tracking-[0.18em] text-zinc-500">TRIP NAME</span>
                    <input
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-700"
                      onChange={(event) => setTripName(event.target.value)}
                      placeholder="e.g., Tokyo Spring Escape"
                      type="text"
                      value={tripName}
                    />
                  </label>
                  <label className="block p-3">
                    <span className="mb-1 block text-[9px] font-bold tracking-[0.18em] text-zinc-500">DESTINATION</span>
                    <input
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-700"
                      onChange={(event) => setDestination(event.target.value)}
                      placeholder="Search city, region, or country"
                      type="text"
                      value={destination}
                    />
                  </label>
                </div>

                <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[#1e1e24]">
                  <label className="block border-b border-zinc-800/60 p-3">
                    <span className="mb-1 flex items-center gap-2 text-[9px] font-bold tracking-[0.18em] text-zinc-500">
                      <CalendarDays className="h-3 w-3" aria-hidden="true" />
                      START DATE ({currentYear})
                    </span>
                    <input
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-700"
                      onChange={(event) => setStartDate(event.target.value)}
                      placeholder="e.g., April 12"
                      type="text"
                      value={startDate}
                    />
                  </label>
                  <label className="block p-3">
                    <span className="mb-1 block text-[9px] font-bold tracking-[0.18em] text-zinc-500">END DATE ({currentYear})</span>
                    <input
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-700"
                      onChange={(event) => setEndDate(event.target.value)}
                      placeholder="e.g., April 26"
                      type="text"
                      value={endDate}
                    />
                  </label>
                </div>
              </div>

              {state.status === "error" || state.status === "timeout" ? (
                <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100">
                  {state.message}
                </p>
              ) : null}

              <button
                aria-label="Close create trip form"
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-full border border-zinc-800 px-4 py-2 text-sm font-bold text-zinc-400 transition hover:border-zinc-700 hover:text-white focus:outline-none focus:ring-4 focus:ring-orange-400/20"
                onClick={closeModalState}
                type="button"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Close
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.aside>
    </>
  );
}

function normalizeDateField(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return null;
}
