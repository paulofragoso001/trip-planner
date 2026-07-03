"use client";

import Link from "next/link";
import { motion, useDragControls, useReducedMotion } from "framer-motion";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PlacePhoto } from "@/components/place-photo";
import type { TripMapItem } from "@/components/TripMap";
import type { UnmappedMapSegment } from "@/app/dashboard/trips/[tripId]/map/loader";
import { ActivityDetailSheet } from "@/components/trip/activity-detail-sheet";
import { waylineCopy } from "@/lib/copy/wayline-copy";
import { hasResolvedRoute, routeEndpointLabel } from "@/lib/trip-segment-route";
import { loadAppleMapKitToken } from "@/lib/map/apple-mapkit-token";

type ConnectedTripMapProps = {
  destination: string | null;
  items: TripMapItem[];
  searchUrl: string | null;
  tripId: string;
  activitySegments?: UnmappedMapSegment[];
  unmappedCount?: number;
  unmappedSegments?: UnmappedMapSegment[];
};

type ItineraryMapKitCoordinate = {
  latitude: number;
  longitude: number;
};

type ItineraryMapKitAnnotation = {
  addEventListener?: (eventName: string, handler: () => void) => void;
  element?: HTMLElement;
  selected?: boolean;
  title?: string;
};

type ItineraryMapKitOverlay = unknown;

type ItineraryMapKitMap = {
  addAnnotations?: (annotations: ItineraryMapKitAnnotation[]) => void;
  addOverlay?: (overlay: ItineraryMapKitOverlay) => void;
  annotations?: ItineraryMapKitAnnotation[];
  destroy?: () => void;
  overlays?: ItineraryMapKitOverlay[];
  removeAnnotations?: (annotations: ItineraryMapKitAnnotation[]) => void;
  removeOverlays?: (overlays: ItineraryMapKitOverlay[]) => void;
  setCenterAnimated?: (coordinate: ItineraryMapKitCoordinate, animate?: boolean) => void;
  setRegionAnimated?: (region: unknown, animate?: boolean) => void;
  showAnnotations?: (
    annotations: ItineraryMapKitAnnotation[],
    options?: { animate?: boolean; padding?: unknown }
  ) => void;
  showItems?: (
    items: Array<ItineraryMapKitAnnotation | ItineraryMapKitOverlay>,
    options?: { animate?: boolean; padding?: unknown }
  ) => void;
};

type ItineraryMapKitRuntime = {
  Annotation: new (
    coordinate: ItineraryMapKitCoordinate,
    elementFactory: () => HTMLElement,
    options?: Record<string, unknown>
  ) => ItineraryMapKitAnnotation;
  ColorScheme?: {
    Dark?: string;
  };
  Coordinate: new (latitude: number, longitude: number) => ItineraryMapKitCoordinate;
  CoordinateRegion?: new (
    center: ItineraryMapKitCoordinate,
    span: { latitudeDelta: number; longitudeDelta: number }
  ) => unknown;
  FeatureVisibility?: {
    Hidden?: string;
  };
  Map: new (container: HTMLElement, options?: Record<string, unknown>) => ItineraryMapKitMap;
  MarkerAnnotation: new (
    coordinate: ItineraryMapKitCoordinate,
    options?: Record<string, unknown>
  ) => ItineraryMapKitAnnotation;
  Padding?: new (top: number, right: number, bottom: number, left: number) => unknown;
  PolylineOverlay?: new (
    coordinates: ItineraryMapKitCoordinate[],
    options?: Record<string, unknown>
  ) => ItineraryMapKitOverlay;
  Style?: new (options?: Record<string, unknown>) => unknown;
  init: (options: { authorizationCallback: (done: (token: string) => void) => void }) => void;
};

declare global {
  interface Window {
    __almidyMapKitInitialized?: boolean;
  }
}

type RouteMapStop = {
  id: string;
  lat: number;
  lng: number;
  locationName: string;
};

const APPLE_MAPKIT_SCRIPT_ID = "almidy-apple-mapkit-js";
const APPLE_MAPKIT_SCRIPT_SRC = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";

let mapKitScriptPromise: Promise<void> | null = null;

export function ConnectedTripMap({
  destination,
  items,
  searchUrl,
  tripId,
  activitySegments = [],
  unmappedCount = 0,
  unmappedSegments = []
}: ConnectedTripMapProps) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [showAllPlaces, setShowAllPlaces] = useState(false);
  const dayLabels = useMemo(
    () => Array.from(new Set(items.map((item) => item.dayLabel).filter(Boolean))) as string[],
    [items]
  );
  const hasDayFilter = dayLabels.length > 1;
  const [selectedDay, setSelectedDay] = useState<string>("");
  const selectedDayKey = hasDayFilter ? selectedDay || dayLabels[0] : "";
  const dayFilteredItems = useMemo(
    () =>
      hasDayFilter && selectedDayKey !== "all"
        ? items.filter((item) => item.dayLabel === selectedDayKey)
        : items,
    [hasDayFilter, items, selectedDayKey]
  );
  const visibleItems = useMemo(
    () =>
      hasDayFilter || showAllPlaces || dayFilteredItems.length <= 5
        ? dayFilteredItems
        : dayFilteredItems.slice(0, 5),
    [dayFilteredItems, hasDayFilter, showAllPlaces]
  );
  const [selectedId, setSelectedId] = useState<string | null>(visibleItems[0]?.id ?? null);
  const [detailItem, setDetailItem] = useState<TripMapItem | null>(null);
  const [isTimelineMaximized, setIsTimelineMaximized] = useState(false);
  const [pendingRetry, setPendingRetry] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const routeSheetDragControls = useDragControls();
  const reduceMotion = useReducedMotion();
  const selectedItem = visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0];
  const selectedPlaceDisplay = selectedItem ? placeDisplayForMapItem(selectedItem) : null;
  const selectedIndex = selectedItem
    ? Math.max(visibleItems.findIndex((item) => item.id === selectedItem.id), 0)
    : 0;
  const selectedPosition = selectedIndex + 1;
  const selectedPlaceUrl = selectedItem ? googleMapsUrlForItem(selectedItem) : null;
  const hiddenPlaceCount = Math.max(dayFilteredItems.length - visibleItems.length, 0);
  const routeSummary = buildRouteSummary(visibleItems);
  const mapStops = useMemo(() => getRouteMapStops(visibleItems), [visibleItems]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hasDayFilter && (!selectedDay || (!dayLabels.includes(selectedDay) && selectedDay !== "all"))) {
      setSelectedDay(dayLabels[0] || "");
    }
  }, [dayLabels, hasDayFilter, selectedDay]);

  useEffect(() => {
    if (!visibleItems.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !visibleItems.some((item) => item.id === selectedId)) {
      setSelectedId(visibleItems[0]?.id ?? null);
    }
  }, [selectedId, visibleItems]);

  async function retryLocation(segmentId: string) {
    setPendingRetry(segmentId);
    setRetryMessage("Retrying location matching...");
    try {
      const response = await fetch(`/api/trip-segments/${segmentId}/retry-location`, {
        headers: { Accept: "application/json" },
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readError(payload, "Location matching is temporarily unavailable."));
      const status = payload?.data?.status;
      setRetryMessage(status === "resolved" ? "Location matched." : "Location still needs attention.");
      router.refresh();
    } catch (error) {
      setRetryMessage(error instanceof Error ? error.message : "Location matching is temporarily unavailable.");
    } finally {
      setPendingRetry(null);
    }
  }

  function handleRouteSheetDragEnd(
    _: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { y: number }; velocity: { y: number } }
  ) {
    if (info.offset.y < -42 || info.velocity.y < -340) {
      setIsTimelineMaximized(true);
      return;
    }

    if (info.offset.y > 42 || info.velocity.y > 340) {
      setIsTimelineMaximized(false);
    }
  }

  return (
    <div
      className="relative min-h-[100dvh] overflow-hidden bg-slate-950 lg:min-h-0 lg:overflow-visible lg:rounded-[2rem] lg:bg-transparent"
      data-testid="connected-trip-map"
    >
      {items.length ? (
        <div className="relative min-h-[100dvh] lg:grid lg:min-h-0 lg:gap-3">
          <div className="relative overflow-hidden rounded-none border-0 bg-slate-950 shadow-none lg:rounded-[1.75rem] lg:border lg:border-slate-800 lg:shadow-sm">
            <ConnectedItineraryMap
              coordinates={mapStops}
              onSelectStop={(id) => {
                const itemId = id.split(":")[0];
                if (itemId) setSelectedId(itemId);
              }}
              selectedId={selectedId}
            />

            <div className="pointer-events-none absolute left-1/2 top-4 z-10 hidden -translate-x-1/2 lg:block">
              <div className="whitespace-nowrap rounded-full bg-white/95 px-4 py-2 text-xs font-black text-slate-950 shadow-lg ring-1 ring-slate-200 backdrop-blur sm:text-sm">
                {routeSummary}
              </div>
            </div>

            {hasDayFilter ? (
              <div
                aria-label="Map day filter"
                className="absolute left-3 right-3 top-16 z-10 hidden gap-2 overflow-x-auto rounded-2xl bg-white/90 p-2 text-xs font-black text-slate-700 shadow-lg ring-1 ring-slate-200 backdrop-blur lg:flex"
                data-testid="map-day-filter-overlay"
              >
                {["all", ...dayLabels].map((day) => {
                  const active = (selectedDayKey || dayLabels[0]) === day;
                  return (
                    <button
                      className={[
                        "min-h-10 shrink-0 rounded-xl px-3 transition",
                        active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      ].join(" ")}
                      key={day}
                      onClick={() => {
                        setSelectedDay(day);
                        setShowAllPlaces(false);
                      }}
                      type="button"
                    >
                      {day === "all" ? "All" : day}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <motion.div
            animate={{
              "--route-sheet-height": isTimelineMaximized ? "85dvh" : "56dvh"
            } as Record<string, string>}
            className="absolute inset-x-0 bottom-0 z-20 flex h-[var(--route-sheet-height)] flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-slate-950/92 p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] text-white shadow-2xl backdrop-blur-2xl sm:p-4 lg:relative lg:inset-auto lg:h-auto lg:overflow-visible lg:rounded-[2rem] lg:border-slate-200 lg:bg-white lg:pb-4 lg:text-slate-950 lg:shadow-sm lg:backdrop-blur-none"
            data-map-bottom-sheet="true"
            data-sheet-state={isTimelineMaximized ? "expanded" : "collapsed"}
            data-testid="map-route-panel"
            drag="y"
            dragControls={routeSheetDragControls}
            dragConstraints={{ bottom: 0, top: 0 }}
            dragElastic={0.06}
            dragListener={false}
            onDragEnd={handleRouteSheetDragEnd}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", damping: 26, stiffness: 210 }}
          >
            <button
              aria-label={isTimelineMaximized ? "Collapse route timeline sheet" : "Expand route timeline sheet"}
              className="mx-auto mb-3 grid h-6 w-20 shrink-0 touch-none place-items-center rounded-full focus:outline-none focus:ring-4 focus:ring-orange-300/20 lg:hidden"
              onClick={() => setIsTimelineMaximized((current) => !current)}
              onPointerDown={(event) => routeSheetDragControls.start(event)}
              type="button"
            >
              <span className="h-1.5 w-16 rounded-full bg-white/45" />
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:overflow-visible lg:pr-0">
              <div className="grid min-w-0 content-start gap-3">
            {selectedItem ? (
            <>
              {hasDayFilter ? (
                <div
                  aria-label="Map day filter"
                  className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 text-xs font-black lg:hidden"
                  data-testid="map-mobile-day-filter"
                >
                  {["all", ...dayLabels].map((day) => {
                    const active = (selectedDayKey || dayLabels[0]) === day;
                    return (
                      <button
                        aria-pressed={active}
                        className={[
                          "min-h-10 shrink-0 rounded-xl px-3 transition",
                          active ? "bg-white text-slate-950" : "bg-white/10 text-white/72 ring-1 ring-white/10"
                        ].join(" ")}
                        key={day}
                        onClick={() => {
                          setSelectedDay(day);
                          setShowAllPlaces(false);
                        }}
                        type="button"
                      >
                        {day === "all" ? "All" : day}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {!hasDayFilter && !showAllPlaces && items.length > visibleItems.length ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900">
                  <span>Showing first {visibleItems.length} of {items.length} places</span>
                  <button
                    className="inline-flex min-h-9 items-center justify-center rounded-xl bg-white px-3 font-black text-blue-800 ring-1 ring-blue-100 disabled:opacity-60"
                    data-testid="map-show-all-places"
                    disabled={!hydrated}
                    onClick={() => setShowAllPlaces(true)}
                    type="button"
                  >
                    {hydrated ? "Show all places" : "Preparing..."}
                  </button>
                </div>
              ) : !hasDayFilter && showAllPlaces && items.length > 5 ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                  <span>Showing all {items.length} places</span>
                  <button
                    className="inline-flex min-h-9 items-center justify-center rounded-xl bg-white px-3 font-black text-slate-700 ring-1 ring-slate-200 disabled:opacity-60"
                    data-testid="map-show-first-places"
                    disabled={!hydrated}
                    onClick={() => setShowAllPlaces(false)}
                    type="button"
                  >
                    Show first 5
                  </button>
                </div>
              ) : null}
              <div
                className="min-w-0 overflow-hidden rounded-[1.5rem] bg-slate-950 p-3 text-white shadow-lg ring-1 ring-slate-900"
                data-testid="map-selected-route-card"
              >
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
                  {selectedPosition} of {visibleItems.length}
                </p>
                <div className="mt-3 grid min-w-0 grid-cols-[64px_minmax(0,1fr)] gap-2 sm:grid-cols-[104px_minmax(0,1fr)] sm:gap-3 sm:items-center">
                  <div className="relative min-w-0">
                  <PlacePhoto
                    alt={selectedItem.imageAlt || `Photo of ${selectedPlaceDisplay?.name || selectedItem.title}`}
                    attribution={selectedItem.imageAttribution}
                    className="h-16 w-16 rounded-2xl sm:h-24 sm:w-24 xl:h-28 xl:w-28"
                    fallbackLabel={selectedItem.category || "Place"}
                    src={selectedItem.imageUrl}
                  />
                  <span className="absolute -right-2 -top-2 grid h-8 min-w-8 place-items-center rounded-full bg-blue-600 px-2 text-sm font-black text-white shadow-lg ring-4 ring-white sm:h-9 sm:min-w-9">
                    {selectedItem.routeOrder || selectedPosition}
                  </span>
                  </div>
                  <div className="min-w-0">
                  <h3 className="line-clamp-2 break-words text-base font-black leading-tight text-white sm:text-lg">
                    {selectedPlaceDisplay?.name || selectedItem.title}
                  </h3>
                  {selectedPlaceDisplay?.name && selectedPlaceDisplay.name !== selectedItem.title ? (
                    <p className="mt-1 truncate text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/42">
                      {selectedItem.title}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs font-semibold text-white/60">
                    {[selectedItem.dayLabel, selectedItem.timeLabel, selectedItem.category]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {selectedPlaceDisplay?.address ? (
                    <p className="mt-1 line-clamp-1 break-words text-xs text-white/62 sm:line-clamp-2">{selectedPlaceDisplay.address}</p>
                  ) : null}
                  {selectedItem.route ? (
                    <div className="mt-2 grid gap-1 text-xs font-semibold text-white/65">
                      <p className="truncate">From: {routeEndpointLabel(selectedItem.route.origin) || "Origin needed"}</p>
                      <p className="truncate">To: {routeEndpointLabel(selectedItem.route.destination) || "Destination needed"}</p>
                    </div>
                  ) : null}
                  <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <button
                      className="inline-flex min-h-10 min-w-0 items-center justify-center rounded-xl bg-white/10 px-2 text-xs font-black text-white ring-1 ring-white/12 sm:px-3"
                      onClick={() => setDetailItem(selectedItem)}
                      type="button"
                    >
                      Details
                    </button>
                    {selectedPlaceUrl ? (
                      <a
                        className="inline-flex min-h-10 min-w-0 items-center justify-center rounded-xl bg-white px-2 text-xs font-black text-slate-950 sm:px-3"
                        href={selectedPlaceUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Maps
                      </a>
                    ) : null}
                    <Link
                      className="col-span-2 inline-flex min-h-10 min-w-0 items-center justify-center rounded-xl bg-white/10 px-2 text-xs font-black text-white ring-1 ring-white/12 sm:col-span-1 sm:px-3"
                      href={`/dashboard/trips/${encodeURIComponent(tripId)}/timeline?mode=map#${selectedItem.id}`}
                    >
                      Itinerary
                    </Link>
                  </div>
                  </div>
                </div>
              </div>
            </>
            ) : null}

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55 lg:text-slate-500">Route places</p>
                {hiddenPlaceCount ? (
                  <p className="text-xs font-bold text-white/50 lg:text-slate-500">{hiddenPlaceCount} hidden</p>
                ) : null}
              </div>
              <div className="grid min-w-0 content-start items-start gap-1.5 overflow-visible pr-1 sm:gap-2 sm:pr-0" data-testid="map-route-list">
                {visibleItems.map((item, index) => {
                  const active = item.id === selectedItem?.id;
                  const routeNumber = item.routeOrder || index + 1;

                  return (
                    <button
                      aria-current={active ? "true" : undefined}
                      className={[
                        "w-full min-w-0 min-h-11 rounded-2xl border px-2.5 py-2 text-left text-sm transition",
                        "h-auto self-start",
                        active
                          ? "border-blue-300 bg-blue-50 text-blue-950"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      ].join(" ")}
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      type="button"
                    >
                      <span className="flex items-center gap-3">
                        <PlacePhoto
                          alt={item.imageAlt || `Photo of ${placeDisplayForMapItem(item).name}`}
                          attribution={item.imageAttribution}
                          className="h-11 w-11 shrink-0 rounded-xl"
                          fallbackLabel={item.category || "Place"}
                          src={item.imageUrl}
                        />
                        <span className="grid h-8 min-w-8 shrink-0 place-items-center rounded-full bg-blue-600 px-2 text-xs font-black text-white">
                          {routeNumber}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-black leading-tight">{placeDisplayForMapItem(item).name}</span>
                          <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">
                            {[item.dayLabel, item.timeLabel, item.category].filter(Boolean).join(" · ")}
                          </span>
                          {placeDisplayForMapItem(item).address ? (
                            <span className="mt-0.5 block truncate text-xs font-semibold text-slate-400">
                              {placeDisplayForMapItem(item).address}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-3 text-sm font-black text-slate-950 transition hover:bg-slate-100 lg:bg-slate-950 lg:text-white lg:hover:bg-slate-800"
                href={`/dashboard/trips/${encodeURIComponent(tripId)}/timeline#new-plan`}
              >
                Add trip item
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white/10 px-3 text-sm font-black text-white ring-1 ring-white/12 transition hover:bg-white/15 lg:bg-white lg:text-slate-950 lg:ring-slate-200 lg:hover:bg-slate-50"
                href={`/dashboard/trips/${encodeURIComponent(tripId)}/ideas`}
              >
                Open Ideas
              </Link>
            </div>

            {items.length && unmappedCount ? (
              <div
                className="grid gap-2 rounded-2xl bg-amber-300/12 px-3 py-3 text-sm font-semibold text-amber-50 ring-1 ring-amber-200/15 lg:bg-amber-50 lg:text-amber-800 lg:ring-0"
                data-testid="map-unresolved-location-summary"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-black">Some places need confirmed locations.</p>
                    <p className="mt-1 text-xs font-semibold text-amber-100/75 lg:text-amber-700">
                      They stay off the route until a mapped place is selected.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2">
                  {unmappedSegments.slice(0, 3).map((segment) => (
                    <MapUnresolvedSegmentAction
                      key={segment.id}
                      pending={pendingRetry === segment.id}
                      segment={segment}
                      tripId={tripId}
                      onRetry={() => retryLocation(segment.id)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
              </div>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="relative min-h-[100dvh] overflow-hidden bg-slate-950 lg:min-h-[520px] lg:rounded-[2rem] lg:border lg:border-slate-200">
          <div
            className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.16)_1px,transparent_1px),radial-gradient(circle_at_32%_24%,rgba(56,189,248,0.28),transparent_34%),radial-gradient(circle_at_72%_64%,rgba(37,99,235,0.22),transparent_38%),linear-gradient(135deg,#08111f,#132a46_54%,#07111f)] bg-[size:72px_72px,72px_72px,auto,auto,auto]"
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute left-5 top-5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white/70 ring-1 ring-white/10">
            {destination || "Trip map"}
          </div>
          <section
            className="absolute inset-x-0 bottom-0 z-10 rounded-t-[2rem] border border-white/10 bg-slate-950/92 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-sm text-white shadow-2xl backdrop-blur-2xl lg:inset-x-4 lg:bottom-4 lg:rounded-[1.5rem] lg:pb-4"
            data-testid="compact-route-empty-state"
          >
            <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-white/45 lg:hidden" aria-hidden="true" />
            <h3 className="text-base font-black text-white">No route places yet</h3>
            <p className="mt-1.5 max-w-xl leading-5 text-white/65">
              Add a trip item or open Ideas to build your route.
            </p>
            {unmappedCount ? (
              <p className="mt-3 rounded-2xl bg-amber-300/14 px-3 py-2 font-semibold text-amber-100 ring-1 ring-amber-200/15">
                {unmappedCount} place{unmappedCount === 1 ? "" : "s"} need confirmed locations before they can appear on this map.
              </p>
            ) : null}
            {unmappedSegments.length ? (
              <div className="mt-3 grid gap-2" data-testid="map-empty-unresolved-list">
                {unmappedSegments.slice(0, 3).map((segment) => (
                  <MapUnresolvedSegmentAction
                    key={segment.id}
                    pending={pendingRetry === segment.id}
                    segment={segment}
                    tripId={tripId}
                    onRetry={() => retryLocation(segment.id)}
                  />
                ))}
              </div>
            ) : null}
            {!unmappedCount && activitySegments.length ? (
              <p className="mt-3 rounded-2xl bg-blue-300/14 px-3 py-2 font-semibold text-blue-100 ring-1 ring-blue-200/15">
                You have unscheduled activities, but no mapped places yet.
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-4 text-sm font-bold text-slate-950 transition hover:bg-slate-100"
                href={`/dashboard/trips/${encodeURIComponent(tripId)}/timeline#new-plan`}
              >
                Add trip item
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white/10 px-4 text-sm font-bold text-white ring-1 ring-white/12 transition hover:bg-white/15"
                href={`/dashboard/trips/${encodeURIComponent(tripId)}/ideas`}
              >
                Open Ideas
              </Link>
            </div>
          </section>
        </div>
      )}

      {unmappedSegments.length ? (
        <div className="hidden gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm sm:p-4 lg:grid">
          <p className="font-black text-slate-950">Needs location</p>
          {unmappedSegments.slice(0, 5).map((segment) => (
            <div className="rounded-xl bg-slate-50 px-3 py-3" key={segment.id}>
              <p className="break-words font-bold text-slate-800">{segment.title}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {copyForLocationStatus(segment)}
              </p>
              {segment.safeRejectedAddress ? (
                <p className="mt-1 text-xs text-slate-500">
                  Found outside this trip: {segment.safeRejectedAddress}
                </p>
              ) : null}
              <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-black text-slate-800 ring-1 ring-slate-200 disabled:opacity-60"
                  disabled={Boolean(pendingRetry)}
                  onClick={() => retryLocation(segment.id)}
                  type="button"
                >
                  {pendingRetry === segment.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Retry location
                </button>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-3 text-xs font-black text-slate-800 ring-1 ring-slate-200"
                  href={`/dashboard/trips/${encodeURIComponent(tripId)}/timeline#${encodeURIComponent(segment.id)}`}
                >
                  Edit location
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {activitySegments.length ? (
        <div className="hidden gap-2 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm sm:p-4 lg:grid">
          <p className="font-black text-blue-950">Unscheduled activities</p>
          {activitySegments.slice(0, 5).map((segment) => (
            <div className="rounded-xl bg-white/80 px-3 py-3" key={segment.id}>
              <p className="break-words font-bold text-blue-950">{segment.title}</p>
              <p className="mt-1 text-xs font-semibold text-blue-800">
                {waylineCopy.location.activityIdea}
              </p>
              <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-3 text-xs font-black text-white"
                  href={`/dashboard/trips/${encodeURIComponent(tripId)}/ideas`}
                >
                  Find suggestions
                </Link>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-3 text-xs font-black text-blue-900 ring-1 ring-blue-100"
                  href={`/dashboard/trips/${encodeURIComponent(tripId)}/timeline#${encodeURIComponent(segment.id)}`}
                >
                  Add meeting point
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {retryMessage ? (
        <p aria-live="polite" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
          {retryMessage}
        </p>
      ) : null}

      <ActivityDetailSheet
        onClose={() => setDetailItem(null)}
        target={detailItem ? { item: detailItem, type: "segment" } : null}
        tripId={tripId}
      />
    </div>
  );
}

function ConnectedItineraryMap({
  coordinates,
  onSelectStop,
  selectedId
}: {
  coordinates: RouteMapStop[];
  onSelectStop?: (id: string) => void;
  selectedId?: string | null;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<ItineraryMapKitMap | null>(null);
  const [runtimeState, setRuntimeState] = useState<"loading" | "ready" | "error" | "missing-token">("loading");

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const token = await loadAppleMapKitToken();

        if (!token) {
          if (!cancelled) setRuntimeState("missing-token");
          return;
        }

        await loadMapKitScript();
        const mapkit = window.mapkit as ItineraryMapKitRuntime | undefined;

        if (cancelled || !mapkit || !mapContainerRef.current || mapRef.current) {
          if (!cancelled) setRuntimeState(mapkit ? "ready" : "error");
          return;
        }

        if (!window.__almidyMapKitInitialized) {
          mapkit.init({
            authorizationCallback: (done) => {
              done(token);
            }
          });
          window.__almidyMapKitInitialized = true;
        }

        mapRef.current = new mapkit.Map(mapContainerRef.current, {
          center: new mapkit.Coordinate(25.7617, -80.1918),
          colorScheme: mapkit.ColorScheme?.Dark,
          isRotationEnabled: false,
          showsCompass: mapkit.FeatureVisibility?.Hidden,
          showsMapTypeControl: false,
          showsScale: mapkit.FeatureVisibility?.Hidden,
          showsUserLocationControl: false,
          showsZoomControl: false
        });
        setRuntimeState("ready");
      } catch {
        if (!cancelled) setRuntimeState("error");
      }
    }

    void initialize();

    return () => {
      cancelled = true;
      const map = mapRef.current;
      removeMapKitArtifacts(map);
      map?.destroy?.();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const mapkit = window.mapkit as ItineraryMapKitRuntime | undefined;
    const map = mapRef.current;

    if (runtimeState !== "ready" || !mapkit || !map || coordinates.length === 0) {
      return;
    }

    removeMapKitArtifacts(map);

    const annotations = coordinates.map((coordinate, index) =>
      createItineraryStopAnnotation({
        coordinate,
        index,
        isActive: coordinate.id.startsWith(selectedId ?? "__none__"),
        mapkit,
        onSelect: () => onSelectStop?.(coordinate.id)
      })
    );

    map.addAnnotations?.(annotations);

    const overlays: ItineraryMapKitOverlay[] = [];
    if (coordinates.length >= 2 && mapkit.PolylineOverlay) {
      const routeCoordinates = coordinates.map((coordinate) =>
        new mapkit.Coordinate(coordinate.lat, coordinate.lng)
      );
      const style = mapkit.Style
        ? new mapkit.Style({
          lineWidth: 4,
          strokeColor: "#E67E22",
          strokeOpacity: 0.88
        })
        : undefined;
      const routeLine = new mapkit.PolylineOverlay(routeCoordinates, { style });
      overlays.push(routeLine);
      map.addOverlay?.(routeLine);
    }

    fitMapKitToCoordinates({
      annotations,
      coordinates,
      map,
      mapkit,
      overlays
    });
  }, [coordinates, onSelectStop, runtimeState, selectedId]);

  return (
    <div
      className="relative h-[clamp(520px,calc(100dvh-5rem),840px)] w-full overflow-hidden bg-[#17202c]"
      data-map-runtime={runtimeState}
      data-map-system="almidy-apple-map-system"
    >
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,13,0.03),rgba(5,8,13,0.18))]"
      />
      {runtimeState === "loading" ? (
        <div className="absolute inset-0 grid place-items-center text-center text-xs font-black uppercase tracking-[0.18em] text-white/55">
          Preparing route map
        </div>
      ) : null}
      {runtimeState === "error" ? (
        <div className="absolute inset-0 grid place-items-center px-8 text-center text-xs font-black uppercase tracking-[0.16em] text-white/55">
          Apple Maps is temporarily unavailable. Your itinerary is still available below.
        </div>
      ) : null}
      {runtimeState === "missing-token" ? (
        <div className="absolute inset-0 grid place-items-center px-8 text-center text-xs font-black uppercase tracking-[0.16em] text-white/55">
          Apple Maps is not configured for this environment. Your itinerary is still available below.
        </div>
      ) : null}
    </div>
  );
}

function MapUnresolvedSegmentAction({
  onRetry,
  pending,
  segment,
  tripId
}: {
  onRetry: () => void;
  pending: boolean;
  segment: UnmappedMapSegment;
  tripId: string;
}) {
  return (
    <div
      className="rounded-2xl bg-white/8 px-3 py-3 ring-1 ring-white/10 lg:bg-white lg:ring-amber-100"
      data-testid="map-unresolved-location-card"
    >
      <p className="line-clamp-2 break-words text-sm font-black text-white lg:text-slate-950">{segment.title}</p>
      <p className="mt-1 text-xs font-semibold text-amber-100/75 lg:text-amber-800">
        {copyForLocationStatus(segment)}
      </p>
      {segment.safeRejectedAddress ? (
        <p className="mt-1 line-clamp-2 break-words text-xs text-amber-100/65 lg:text-slate-500">
          Found outside this trip: {segment.safeRejectedAddress}
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-black text-slate-950 disabled:opacity-60 lg:bg-slate-950 lg:text-white"
          disabled={pending}
          onClick={onRetry}
          type="button"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Retry
        </button>
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-white/10 px-3 text-xs font-black text-white ring-1 ring-white/12 lg:bg-white lg:text-slate-950 lg:ring-slate-200"
          href={`/dashboard/trips/${encodeURIComponent(tripId)}/timeline#${encodeURIComponent(segment.id)}`}
        >
          Edit
        </Link>
      </div>
    </div>
  );
}

function googleMapsUrlForItem(item: TripMapItem) {
  if (hasResolvedRoute(item.route)) {
    const origin = item.route?.origin;
    const destination = item.route?.destination;
    const originValue = typeof origin?.lat === "number" && typeof origin.lng === "number"
      ? `${origin.lat},${origin.lng}`
      : routeEndpointLabel(origin);
    const destinationValue = typeof destination?.lat === "number" && typeof destination.lng === "number"
      ? `${destination.lat},${destination.lng}`
      : routeEndpointLabel(destination);

    if (originValue && destinationValue) {
      return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originValue)}&destination=${encodeURIComponent(destinationValue)}`;
    }
  }

  const display = placeDisplayForMapItem(item);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    display.address || display.name
  )}`;
}

function placeDisplayForMapItem(item: TripMapItem) {
  const metadata = isRecord(item.providerMetadata) ? item.providerMetadata : {};
  const name = readMetadataString(metadata, ["name", "displayName", "placeName"]) || item.title;
  const address =
    readMetadataString(metadata, ["formattedAddress", "formatted_address", "address"]) ||
    item.address ||
    null;

  return { address, name };
}

function readMetadataString(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function buildRouteSummary(items: TripMapItem[]) {
  const routeCount = items.filter((item) => hasResolvedRoute(item.route)).length;
  const placeCount = items.length - routeCount;
  const parts: string[] = [];
  if (placeCount) parts.push(`${placeCount} place${placeCount === 1 ? "" : "s"}`);
  if (routeCount) parts.push(`${routeCount} route${routeCount === 1 ? "" : "s"}`);
  return `${parts.join(" · ") || "Route"} · Route preview`;
}

function RetryAllButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function retryAll() {
    setPending(true);
    try {
      await fetch(`/api/trips/${tripId}/retry-locations`, {
        headers: { Accept: "application/json" },
        method: "POST"
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
      disabled={pending}
      onClick={retryAll}
      type="button"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      Retry all locations
    </button>
  );
}

function copyForLocationStatus(segment: UnmappedMapSegment) {
  if (segment.locationStatus === "wrong_city_rejected") {
    return waylineCopy.location.wrongCity;
  }
  if (segment.locationStatus === "provider_failed") {
    return waylineCopy.location.providerFailed;
  }
  if (segment.locationStatus === "manual_location_required") {
    return "Add a confirmed location before this stop appears on the map.";
  }
  return waylineCopy.location.needsLocation;
}

function getRouteMapStops(items: TripMapItem[]): RouteMapStop[] {
  const stops: RouteMapStop[] = [];

  items.forEach((item) => {
    if (hasResolvedRoute(item.route)) {
      const route = item.route;
      if (!route) return;
      const origin = route.origin;
      const destination = route.destination;
      if (typeof origin?.lat === "number" && typeof origin.lng === "number") {
        stops.push({
          id: `${item.id}:origin`,
          lat: origin.lat,
          lng: origin.lng,
          locationName: routeEndpointLabel(origin) || `${item.title} origin`
        });
      }
      if (typeof destination?.lat === "number" && typeof destination.lng === "number") {
        stops.push({
          id: `${item.id}:destination`,
          lat: destination.lat,
          lng: destination.lng,
          locationName: routeEndpointLabel(destination) || `${item.title} destination`
        });
      }
      return;
    }

    if (Number.isFinite(item.lat) && Number.isFinite(item.lng)) {
      stops.push({
        id: item.id,
        lat: item.lat,
        lng: item.lng,
        locationName: placeDisplayForMapItem(item).name
      });
    }
  });

  return stops;
}

function createItineraryStopAnnotation({
  coordinate,
  index,
  isActive,
  mapkit,
  onSelect
}: {
  coordinate: RouteMapStop;
  index: number;
  isActive: boolean;
  mapkit: ItineraryMapKitRuntime;
  onSelect: () => void;
}) {
  const annotation = new mapkit.Annotation(
    new mapkit.Coordinate(coordinate.lat, coordinate.lng),
    () =>
      createItineraryStopAnnotationElement({
        coordinate,
        index,
        isActive,
        onSelect
      }),
    {
      anchorOffset: new DOMPoint(0, -38),
      data: coordinate,
      selected: isActive,
      title: coordinate.locationName
    }
  );

  annotation.addEventListener?.("select", onSelect);
  annotation.selected = isActive;
  return annotation;
}

function createItineraryStopAnnotationElement({
  coordinate,
  index,
  isActive,
  onSelect
}: {
  coordinate: RouteMapStop;
  index: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", `Select ${coordinate.locationName}`);
  button.dataset.active = isActive ? "true" : "false";
  button.dataset.stopId = coordinate.id;
  button.dataset.stopLatitude = coordinate.lat.toFixed(5);
  button.dataset.stopLongitude = coordinate.lng.toFixed(5);
  button.dataset.testid = "itinerary-apple-map-stop-pin";
  button.style.pointerEvents = "auto";
  button.className = [
    "group pointer-events-auto flex -translate-x-1/2 -translate-y-full touch-manipulation flex-col items-center overflow-visible text-center focus:outline-none",
    isActive ? "z-50" : "z-40"
  ].join(" ");

  const marker = document.createElement("span");
  marker.className = [
    "grid h-11 min-w-11 place-items-center rounded-full border-[2.5px] bg-white px-2 text-sm font-black leading-none text-orange-600 shadow-[0_4px_0_rgba(0,0,0,0.95),0_10px_24px_rgba(0,0,0,0.36)] transition duration-200",
    isActive ? "scale-125 border-orange-500 ring-4 ring-orange-400/60" : "border-black ring-1 ring-white/75"
  ].join(" ");
  marker.textContent = String(index + 1);

  const label = document.createElement("span");
  label.className = [
    "mt-1 block max-w-32 truncate rounded px-1.5 py-0.5 text-[0.72rem] font-black leading-none [text-shadow:0_2px_2px_rgba(0,0,0,0.95),0_0_8px_rgba(0,0,0,0.85)]",
    isActive ? "bg-orange-600 text-white" : "bg-black/56 text-white"
  ].join(" ");
  label.textContent = coordinate.locationName;

  button.append(marker, label);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onSelect();
  });

  return button;
}

function loadMapKitScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("MapKit is browser-only."));
  }

  if (window.mapkit) {
    return Promise.resolve();
  }

  if (mapKitScriptPromise) {
    return mapKitScriptPromise;
  }

  mapKitScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(APPLE_MAPKIT_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("MapKit script failed.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.id = APPLE_MAPKIT_SCRIPT_ID;
    script.src = APPLE_MAPKIT_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("MapKit script failed."));
    document.head.appendChild(script);
  });

  return mapKitScriptPromise;
}

function removeMapKitArtifacts(map: ItineraryMapKitMap | null) {
  if (!map) return;

  if (map.overlays?.length) {
    map.removeOverlays?.(map.overlays);
  }

  if (map.annotations?.length) {
    map.removeAnnotations?.(map.annotations);
  }
}

function fitMapKitToCoordinates({
  annotations,
  coordinates,
  map,
  mapkit,
  overlays
}: {
  annotations: ItineraryMapKitAnnotation[];
  coordinates: RouteMapStop[];
  map: ItineraryMapKitMap;
  mapkit: ItineraryMapKitRuntime;
  overlays: ItineraryMapKitOverlay[];
}) {
  const padding = mapkit.Padding ? new mapkit.Padding(96, 44, 300, 44) : undefined;
  const visibleItems = [...overlays, ...annotations];

  if (visibleItems.length && typeof map.showItems === "function") {
    map.showItems(visibleItems, { animate: true, padding });
    return;
  }

  if (annotations.length && typeof map.showAnnotations === "function") {
    map.showAnnotations(annotations, { animate: true, padding });
    return;
  }

  if (!mapkit.CoordinateRegion || coordinates.length === 0) {
    return;
  }

  const lats = coordinates.map((coordinate) => coordinate.lat);
  const lngs = coordinates.map((coordinate) => coordinate.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const center = new mapkit.Coordinate((minLat + maxLat) / 2, (minLng + maxLng) / 2);
  const region = new mapkit.CoordinateRegion(center, {
    latitudeDelta: Math.max(maxLat - minLat, 0.05) * 1.35,
    longitudeDelta: Math.max(maxLng - minLng, 0.05) * 1.35
  });

  map.setRegionAnimated?.(region, true);
  map.setCenterAnimated?.(center, true);
}

function readError(payload: unknown, fallback: string) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return fallback;
}
