"use client";

import Link from "next/link";
import {
  Bed,
  ChevronDown,
  ExternalLink,
  ListFilter,
  Loader2,
  Map as MapIcon,
  MapPin,
  Moon,
  MoreHorizontal,
  Navigation,
  Plus,
  ShoppingBag,
  Sparkles,
  Ticket,
  Utensils,
  X
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  TripMapData,
  TripRecommendationView,
  UnmappedMapSegment
} from "@/app/dashboard/trips/[tripId]/map/loader";
import GoogleMapsProvider, { GoogleMapsSurfaceFallback } from "@/components/GoogleMapsProvider";
import { PlacePhoto } from "@/components/place-photo";
import TripMap, { type TripMapDistanceRing, type TripMapItem } from "@/components/TripMap";
import {
  ActivityDetailSheet,
  type ActivityDetailRecommendation
} from "@/components/trip/activity-detail-sheet";
import {
  distanceUnitForLocale,
  formatDistance,
  getDistanceAnchorOptions,
  haversineDistanceKm,
  sortByDistance,
  type DistanceAnchorOption,
  type GeoPoint
} from "@/lib/geo/distance";

type TripIdeasPageProps = TripMapData;

type ActivityFilterId =
  | "all"
  | "food"
  | "places"
  | "activities"
  | "shopping"
  | "nightlife"
  | "lodging";

type ActivityRow =
  | {
      address: string | null;
      bookingUrl: string | null;
      category: ActivityFilterId;
      confirmationCode: string | null;
      ctaHref: string;
      ctaLabel: string;
      endTime: string | null;
      hasEndTime?: boolean;
      hasStartTime?: boolean;
      id: string;
      imageAlt: string | null;
      imageAttribution: string | null;
      imageUrl: string | null;
      kind: string | null;
      lat: number;
      lng: number;
      meta: string;
      notes: string | null;
      provider: string | null;
      providerMetadata: Record<string, unknown> | null;
      providerPlaceId: string | null;
      secondaryHref: string;
      secondaryLabel: string;
      source: string | null;
      startTime: string | null;
      status: string;
      title: string;
      type: "place";
    }
  | {
      address: string | null;
      bookingUrl: string | null;
      category: ActivityFilterId;
      id: string;
      imageAlt: string | null;
      imageAttribution: string | null;
      imageUrl: string | null;
      lat: number | null;
      lng: number | null;
      meta: string;
      provider: string;
      ratingLabel: string | null;
      reason: string | null;
      title: string;
      type: "recommendation";
    }
  | {
      category: ActivityFilterId;
      description: string;
      id: string;
      location: string | null;
      status: string;
      title: string;
      type: "activity" | "needs-location";
    };

const baseFilters: { id: ActivityFilterId; label: string; icon: ReactNode }[] = [
  { id: "all", icon: <Sparkles className="h-4 w-4" aria-hidden="true" />, label: "All" },
  { id: "food", icon: <Utensils className="h-4 w-4" aria-hidden="true" />, label: "Food" },
  { id: "places", icon: <MapPin className="h-4 w-4" aria-hidden="true" />, label: "Places" },
  { id: "activities", icon: <Ticket className="h-4 w-4" aria-hidden="true" />, label: "Activities" },
  { id: "shopping", icon: <ShoppingBag className="h-4 w-4" aria-hidden="true" />, label: "Shopping" },
  { id: "nightlife", icon: <Moon className="h-4 w-4" aria-hidden="true" />, label: "Nightlife" }
];

export function TripIdeasPage({
  activitySegments,
  destination,
  error,
  items,
  recommendations,
  tripId,
  unmappedSegments
}: TripIdeasPageProps) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<ActivityFilterId>("all");
  const [hydrated, setHydrated] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ActivityRow | null>(null);
  const [message, setMessage] = useState("");
  const rows = useMemo(
    () => [
      ...recommendations.map(mapRecommendationRow),
      ...items.map((item) => mapPlaceRow(item, tripId)),
      ...activitySegments.map(mapActivityRow),
      ...unmappedSegments.map(mapNeedsLocationRow)
    ],
    [activitySegments, items, recommendations, tripId, unmappedSegments]
  );
  const filters = useMemo(() => {
    const hasLodging = rows.some((row) => row.category === "lodging");
    return hasLodging
      ? [...baseFilters, { id: "lodging" as const, icon: <Bed className="h-4 w-4" aria-hidden="true" />, label: "Lodging" }]
      : baseFilters;
  }, [rows]);
  const discoveryRows = rows.filter((row) => row.type !== "place");
  const categoryCount = new Set(
    discoveryRows.map((row) => row.category).filter((category) => category !== "all")
  ).size;
  const showFilters = categoryCount > 1;
  const filteredDiscoveryRows =
    !showFilters || activeFilter === "all"
      ? discoveryRows
      : discoveryRows.filter((row) => row.category === activeFilter);
  const recommendationsForFilter = filteredDiscoveryRows.filter((row) => row.type === "recommendation");
  const savedPlacesForFilter = rows.filter((row) => row.type === "place");
  const activityIdeasForFilter = filteredDiscoveryRows.filter((row) => row.type === "activity");
  const needsLocationForFilter = filteredDiscoveryRows.filter((row) => row.type === "needs-location");
  const activeLabel = filters.find((filter) => filter.id === activeFilter)?.label || "selected";
  const mobileRows = useMemo(
    () => [...filteredDiscoveryRows, ...savedPlacesForFilter],
    [filteredDiscoveryRows, savedPlacesForFilter]
  );

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!showFilters && activeFilter !== "all") {
      setActiveFilter("all");
    }
  }, [activeFilter, showFilters]);

  async function run(endpoint: string, label: string) {
    setPendingAction(endpoint);
    setMessage(`${label}...`);

    try {
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" },
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readError(payload, response.status));
      setMessage(label === "Finding ideas" ? "Nearby Ideas updated." : "Done.");
      router.refresh();
    } catch (actionError) {
      setMessage(actionError instanceof Error ? actionError.message : "That action could not be completed.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="min-w-0" data-testid="trip-ideas-page">
      <MobileActivitiesView
        activeFilter={activeFilter}
        destination={destination}
        disabled={Boolean(pendingAction)}
        error={error}
        filters={filters}
        hydrated={hydrated}
        items={items}
        onDismiss={(row) => run(`/api/trip-recommendations/${row.id}/dismiss`, "Dismissing idea")}
        onFilter={setActiveFilter}
        onFindIdeas={() => run(`/api/trips/${tripId}/generate-suggestions`, "Finding ideas")}
        onOpenDetail={setSelectedDetail}
        onSave={(row) => run(`/api/trip-recommendations/${row.id}/save`, "Saving idea")}
        rows={mobileRows}
        showFilters={showFilters}
        tripId={tripId}
      />

      <div className="hidden min-w-0 gap-4 lg:grid" data-testid="desktop-ideas-view">
      {error ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {error}
        </p>
      ) : null}

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
              Ideas
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">All trip activities</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              Review saved ideas, nearby suggestions, and places you may want to add to your itinerary.
            </p>
          </div>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-60 sm:w-auto"
            disabled={Boolean(pendingAction) || items.length === 0}
            onClick={() => run(`/api/trips/${tripId}/generate-suggestions`, "Finding ideas")}
            type="button"
          >
            {pendingAction?.includes("generate-suggestions") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Find ideas
          </button>
        </div>

        {showFilters ? (
          <div className="mt-5" data-testid="activity-category-filters">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Explore nearby
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Activity categories">
              {filters.map((filter) => {
                const active = activeFilter === filter.id;
                return (
                  <button
                    aria-pressed={active}
                    className={[
                      "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3 pr-4 text-xs font-black ring-1 transition",
                      active
                        ? "bg-slate-950 text-white ring-slate-950"
                        : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                    ].join(" ")}
                    disabled={!hydrated}
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    type="button"
                  >
                    <span
                      className={[
                        "grid h-8 w-8 place-items-center rounded-full",
                        active ? "bg-white/12 text-white" : "bg-blue-50 text-blue-700"
                      ].join(" ")}
                    >
                      {filter.icon}
                    </span>
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      {filteredDiscoveryRows.length === 0 && activeFilter !== "all" ? (
        <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
          <p className="font-black text-slate-950">No {activeLabel} ideas yet.</p>
          <p className="mt-1 leading-6">Find ideas near your mapped places or try another category.</p>
          <button
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-60 sm:w-auto"
            disabled={Boolean(pendingAction) || items.length === 0}
            onClick={() => run(`/api/trips/${tripId}/generate-suggestions`, "Finding ideas")}
            type="button"
          >
            {pendingAction?.includes("generate-suggestions") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Find ideas
          </button>
        </section>
      ) : null}

      {recommendationsForFilter.length ? (
        <ActivitySection
          title="Nearby Ideas"
        >
          {recommendationsForFilter.map((row) =>
            row.type === "recommendation" ? (
              <RecommendationRow
                disabled={Boolean(pendingAction)}
                key={row.id}
                onDismiss={() => run(`/api/trip-recommendations/${row.id}/dismiss`, "Dismissing idea")}
                onSave={() => run(`/api/trip-recommendations/${row.id}/save`, "Saving idea")}
                row={row}
              />
            ) : null
          )}
        </ActivitySection>
      ) : null}

      {savedPlacesForFilter.length ? (
        <ActivitySection title="Saved ideas">
          {savedPlacesForFilter.map((row) =>
            row.type === "place" ? <SavedPlaceRow key={row.title} row={row} /> : null
          )}
        </ActivitySection>
      ) : null}

      {activityIdeasForFilter.length ? (
        <ActivitySection title="Activity ideas">
          {activityIdeasForFilter.map((row) =>
            row.type === "activity" ? <StatusRow key={row.id} row={row} tripId={tripId} /> : null
          )}
        </ActivitySection>
      ) : null}

      {needsLocationForFilter.length ? (
        <ActivitySection title="Needs location">
          {needsLocationForFilter.map((row) =>
            row.type === "needs-location" ? <StatusRow key={row.id} row={row} tripId={tripId} /> : null
          )}
        </ActivitySection>
      ) : null}

      {message ? (
        <p aria-live="polite" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
          {message}
        </p>
      ) : null}
      </div>

      {message ? (
        <p aria-live="polite" className="mt-3 rounded-2xl bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 lg:hidden">
          {message}
        </p>
      ) : null}

      <ActivityDetailSheet
        disabled={Boolean(pendingAction)}
        onClose={() => setSelectedDetail(null)}
        onSaveRecommendation={(row) => {
          setSelectedDetail(null);
          void run(`/api/trip-recommendations/${row.id}/save`, "Saving idea");
        }}
        target={toActivityDetailTarget(selectedDetail)}
        tripId={tripId}
      />
    </div>
  );
}

function MobileActivitiesView({
  activeFilter,
  destination,
  disabled,
  error,
  filters,
  hydrated,
  items,
  onDismiss,
  onFilter,
  onFindIdeas,
  onOpenDetail,
  onSave,
  rows,
  showFilters,
  tripId
}: {
  activeFilter: ActivityFilterId;
  destination: string | null;
  disabled: boolean;
  error: string | null;
  filters: { id: ActivityFilterId; label: string; icon: ReactNode }[];
  hydrated: boolean;
  items: TripMapData["items"];
  onDismiss: (row: Extract<ActivityRow, { type: "recommendation" }>) => void;
  onFilter: (filter: ActivityFilterId) => void;
  onFindIdeas: () => void;
  onOpenDetail: (row: ActivityRow) => void;
  onSave: (row: Extract<ActivityRow, { type: "recommendation" }>) => void;
  rows: ActivityRow[];
  showFilters: boolean;
  tripId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [anchorPickerOpen, setAnchorPickerOpen] = useState(false);
  const [currentLocationAnchor, setCurrentLocationAnchor] = useState<DistanceAnchorOption | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const tripTitle = destination?.split(",")[0]?.trim() || "Your trip";
  const locale = typeof window === "undefined" ? "en-US" : window.navigator.language || "en-US";
  const distanceUnit = distanceUnitForLocale(locale);
  const mapItems = useMemo(() => buildMobileActivityMapItems(items, rows), [items, rows]);
  const anchorOptions = useMemo(() => {
    const mappedOptions = getDistanceAnchorOptions(
      items.map((item) => ({
        address: item.address,
        category: item.category,
        id: item.id,
        kind: item.kind,
        lat: item.lat,
        lng: item.lng,
        title: item.title
      }))
    );

    if (!currentLocationAnchor) return mappedOptions;

    return [
      currentLocationAnchor,
      ...mappedOptions.filter((option) => option.id !== currentLocationAnchor.id)
    ];
  }, [currentLocationAnchor, items]);
  const selectedAnchor =
    anchorOptions.find((option) => option.id === anchorId) || anchorOptions[0] || null;
  const anchorPoint = selectedAnchor?.point ?? null;
  const shouldShowSort = Boolean(anchorPoint && rows.some((row) => hasActivityCoordinates(row)));
  const mapItemsWithAnchor = useMemo(() => {
    if (!selectedAnchor || mapItems.some((item) => item.id === selectedAnchor.id)) return mapItems;

    return [
      {
        address: selectedAnchor.detail || null,
        category: "anchor",
        dayLabel: "Anchor",
        id: selectedAnchor.id,
        lat: selectedAnchor.point.lat,
        lng: selectedAnchor.point.lng,
        routeOrder: null,
        status: "anchor",
        title: selectedAnchor.label
      },
      ...mapItems
    ];
  }, [mapItems, selectedAnchor]);
  const selectedMapId =
    selectedAnchor && mapItemsWithAnchor.some((item) => item.id === selectedAnchor.id)
      ? selectedAnchor.id
      : mapItemsWithAnchor[0]?.id ?? null;
  const cityOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.map(getActivityCity).filter((city): city is string => Boolean(city)))
      ).sort((left, right) => left.localeCompare(right)),
    [rows]
  );
  const showCityFilters = cityOptions.length > 1;
  const rowsForCity = useMemo(
    () => (cityFilter === "all" ? rows : rows.filter((row) => getActivityCity(row) === cityFilter)),
    [cityFilter, rows]
  );
  const displayRows = useMemo(() => {
    if (!shouldShowSort) return rowsForCity;
    return sortByDistance(rowsForCity, anchorPoint, getActivityCoordinates);
  }, [anchorPoint, rowsForCity, shouldShowSort]);
  const compactRows = expanded ? displayRows : displayRows.slice(0, 6);
  const visibleActivityCount = displayRows.length;
  const distanceRings = useMemo<TripMapDistanceRing[]>(() => {
    if (!shouldShowSort || !anchorPoint) return [];

    const metersPerUnit = distanceUnit === "mi" ? 1609.344 : 1000;
    return [1, 2, 3].map((value) => ({
      center: anchorPoint,
      id: `distance-${value}-${distanceUnit}`,
      label: `${value}${distanceUnit}`,
      radiusMeters: value * metersPerUnit
    }));
  }, [anchorPoint, distanceUnit, shouldShowSort]);

  useEffect(() => {
    if (!anchorOptions.length) {
      if (anchorId) setAnchorId(null);
      return;
    }

    if (!anchorId || !anchorOptions.some((option) => option.id === anchorId)) {
      setAnchorId(anchorOptions[0]?.id ?? null);
    }
  }, [anchorId, anchorOptions]);

  useEffect(() => {
    if (cityFilter !== "all" && !cityOptions.includes(cityFilter)) {
      setCityFilter("all");
    }
  }, [cityFilter, cityOptions]);

  function requestCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationMessage("Current location is not available in this browser.");
      return;
    }

    setLocationMessage("Requesting current location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextAnchor: DistanceAnchorOption = {
          detail: "Your device location",
          id: "current-location",
          kind: "current-location",
          label: "Current location",
          point: {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
        };

        setCurrentLocationAnchor(nextAnchor);
        setAnchorId(nextAnchor.id);
        setAnchorPickerOpen(false);
        setLocationMessage("");
      },
      () => {
        setLocationMessage("Location permission was not granted. Keeping the previous anchor.");
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 }
    );
  }

  return (
    <section
      className={[
        "relative isolate -mx-1 overflow-hidden bg-[#111113] text-white shadow-2xl ring-1 ring-white/10 lg:hidden",
        expanded ? "min-h-[calc(100svh-1rem)] rounded-[1.6rem]" : "rounded-[2.2rem]"
      ].join(" ")}
      data-testid="mobile-activities-view"
    >
      {!expanded ? (
        <div
          className="relative h-[48svh] min-h-[340px] overflow-hidden bg-[#07182b]"
          aria-label={`${tripTitle} nearby activity map`}
          data-testid="mobile-activity-map"
        >
          {mapItems.length ? (
            <GoogleMapsProvider
              blockChildrenOnError
              fallback={
                <GoogleMapsSurfaceFallback
                  height="48svh"
                  message="Maps are temporarily unavailable. Nearby ideas are still available below."
                />
              }
            >
              <TripMap
                distanceRings={distanceRings}
                height="48svh"
                items={mapItemsWithAnchor}
                mapTheme="dark"
                selectedId={selectedMapId}
                showRouteDetails={false}
                travelMode="WALKING"
              />
            </GoogleMapsProvider>
          ) : (
            <div className="relative h-full overflow-hidden bg-[radial-gradient(circle_at_30%_25%,rgba(37,99,235,0.45),transparent_28%),radial-gradient(circle_at_70%_50%,rgba(249,115,22,0.25),transparent_24%),linear-gradient(135deg,#052f3b,#07111f_52%,#17110b)]">
              <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:44px_44px]" />
              <div className="absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-white/20" />
              <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/16" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/20 via-transparent to-[#111113]" />
          <div className="absolute right-4 top-4 z-10 grid overflow-hidden rounded-2xl bg-black/84 text-orange-400 shadow-2xl ring-1 ring-white/10 backdrop-blur">
            <Link
              aria-label="Open route map"
              className="grid h-12 w-12 place-items-center border-b border-white/10"
              href={`/dashboard/trips/${tripId}/map`}
            >
              <MapIcon className="h-5 w-5" aria-hidden="true" />
            </Link>
            <button
              aria-label="Find ideas near current route"
              className="grid h-12 w-12 place-items-center"
              disabled={disabled}
              onClick={onFindIdeas}
              type="button"
            >
              {disabled ? <Loader2 className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={[
          "relative rounded-t-[2rem] bg-[#1f1f21]/96 pb-[calc(4.5rem+env(safe-area-inset-bottom))] shadow-[0_-20px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/10 backdrop-blur-2xl",
          expanded ? "min-h-[calc(100svh-1rem)]" : "-mt-10"
        ].join(" ")}
        data-testid="mobile-activities-sheet"
      >
        <div className="mx-auto pt-3">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-white/45" />
        </div>

        <div className="px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <button
                className="inline-flex min-h-8 items-center gap-1 text-base font-bold text-white/60"
                onClick={() => setExpanded((current) => !current)}
                type="button"
              >
                Places
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
              <h2 className="mt-0.5 truncate text-3xl font-black tracking-tight text-white">
                {tripTitle}
              </h2>
              <p className="sr-only">All trip activities</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                aria-label="More activity options"
                className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white/70"
                onClick={() => setExpanded((current) => !current)}
                type="button"
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              </button>
              {expanded ? (
                <button
                  aria-label="Collapse activities"
                  className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white/70"
                  onClick={() => setExpanded(false)}
                  type="button"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : (
                <Link
                  aria-label="Close activities"
                  className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white/70"
                  href={`/dashboard/trips/${tripId}`}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>

          {error ? (
            <p className="mt-3 rounded-2xl bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-100">
              {error}
            </p>
          ) : null}

          {showFilters ? (
            <div className="mt-4" data-testid="activity-category-filters">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-orange-500/18 px-4 text-sm font-black text-orange-300">
                  Categories
                  <ListFilter className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="Activity categories">
                {filters.map((filter) => {
                  const active = activeFilter === filter.id;
                  return (
                    <button
                      aria-pressed={active}
                      className={[
                        "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3 text-xs font-black transition",
                        active
                          ? "bg-orange-500 text-white"
                          : "bg-white/8 text-white/72 hover:bg-white/12"
                      ].join(" ")}
                      disabled={!hydrated}
                      key={filter.id}
                      onClick={() => onFilter(filter.id)}
                      type="button"
                    >
                      {filter.icon}
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {showCityFilters ? (
            <div className="mt-3" data-testid="activity-city-filters">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-orange-500/12 px-4 text-sm font-black text-orange-300/80">
                  Cities
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="Activity cities">
                {["all", ...cityOptions].map((city) => {
                  const active = cityFilter === city;
                  const label = city === "all" ? "All cities" : city;
                  return (
                    <button
                      aria-pressed={active}
                      className={[
                        "inline-flex min-h-10 shrink-0 items-center rounded-full px-3 text-xs font-black transition",
                        active
                          ? "bg-orange-500 text-white"
                          : "bg-white/8 text-white/72 hover:bg-white/12"
                      ].join(" ")}
                      key={city}
                      onClick={() => setCityFilter(city)}
                      type="button"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-between gap-3 border-b border-white/10 pb-4 text-sm font-bold text-orange-400">
            {shouldShowSort ? (
              <button
                className="inline-flex min-h-10 shrink-0 items-center gap-1"
                data-testid="distance-sort-control"
                type="button"
              >
                Sort by Distance
                <span aria-hidden="true">↑↓</span>
              </button>
            ) : (
              <span
                className="inline-flex min-h-10 shrink-0 items-center text-white/44"
                data-testid="distance-sort-control"
              >
                Add locations to sort by distance.
              </span>
            )}
            <button
              aria-expanded={anchorPickerOpen}
              className="inline-flex min-h-10 min-w-0 items-center gap-2 text-right disabled:text-white/36"
              data-testid="distance-anchor-selector"
              disabled={!anchorOptions.length}
              onClick={() => setAnchorPickerOpen((current) => !current)}
              type="button"
            >
              <Navigation className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{selectedAnchor?.label || "Choose anchor"}</span>
            </button>
          </div>

          {anchorPickerOpen ? (
            <div
              className="mt-3 rounded-3xl bg-black/28 p-3 ring-1 ring-white/10"
              data-testid="distance-anchor-picker"
            >
              <p className="px-1 text-xs font-black uppercase tracking-[0.18em] text-white/42">
                Sort from
              </p>
              <div className="mt-2 grid gap-2">
                {anchorOptions.map((option) => {
                  const active = selectedAnchor?.id === option.id;
                  return (
                    <button
                      aria-pressed={active}
                      className={[
                        "min-h-12 rounded-2xl px-3 py-2 text-left transition",
                        active
                          ? "bg-orange-500/18 text-orange-200 ring-1 ring-orange-400/35"
                          : "bg-white/8 text-white/78 hover:bg-white/12"
                      ].join(" ")}
                      data-testid="distance-anchor-option"
                      key={option.id}
                      onClick={() => {
                        setAnchorId(option.id);
                        setAnchorPickerOpen(false);
                      }}
                      type="button"
                    >
                      <span className="block truncate text-sm font-black">{option.label}</span>
                      {option.detail ? (
                        <span className="mt-0.5 block truncate text-xs font-semibold opacity-60">
                          {option.detail}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                <button
                  className="min-h-12 rounded-2xl bg-white/8 px-3 py-2 text-left text-sm font-black text-white/78 transition hover:bg-white/12"
                  data-testid="distance-current-location"
                  onClick={requestCurrentLocation}
                  type="button"
                >
                  Use current location
                  <span className="mt-0.5 block text-xs font-semibold text-white/42">
                    Requests permission only after this tap.
                  </span>
                </button>
              </div>
              {locationMessage ? (
                <p aria-live="polite" className="mt-2 px-1 text-xs font-semibold text-white/58">
                  {locationMessage}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          className={[
            "overflow-y-auto px-4 pb-3",
            expanded ? "max-h-[calc(100svh-17rem)]" : "max-h-[40svh]"
          ].join(" ")}
          data-testid="mobile-activity-list"
        >
          {displayRows.length ? (
            <div className="divide-y divide-white/10">
              {compactRows.map((row) => (
                <MobileActivityRow
                  anchorPoint={anchorPoint}
                  disabled={disabled}
                  key={`${row.type}-${row.id}`}
                  locale={locale}
                  onDismiss={onDismiss}
                  onOpenDetail={onOpenDetail}
                  onSave={onSave}
                  row={row}
                  tripId={tripId}
                />
              ))}
              {!expanded && displayRows.length > compactRows.length ? (
                <button
                  className="min-h-12 w-full text-center text-sm font-black text-orange-400"
                  onClick={() => setExpanded(true)}
                  type="button"
                >
                  Show all {displayRows.length} activities
                </button>
              ) : null}
            </div>
          ) : (
            <div className="rounded-3xl bg-white/8 p-4 text-sm text-white/70">
              <p className="font-black text-white">No activities yet.</p>
              <p className="mt-1 leading-5">Find ideas near mapped places or add a trip item.</p>
              <button
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-orange-500 px-4 text-sm font-black text-white disabled:opacity-60"
                disabled={disabled}
                onClick={onFindIdeas}
                type="button"
              >
                {disabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Find ideas
              </button>
            </div>
          )}
        </div>

        <div className="absolute inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-between rounded-[1.6rem] bg-[#202022]/96 px-4 py-3 text-orange-400 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl">
          <button
            aria-label="Show activities list"
            className="grid h-11 w-11 place-items-center rounded-full bg-white/6"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            <ListFilter className="h-5 w-5" aria-hidden="true" />
          </button>
          <p className="text-center text-xs font-bold text-white/48">
            All
            <span className="block text-base font-black text-orange-400">
              {visibleActivityCount} {visibleActivityCount === 1 ? "activity" : "activities"}
            </span>
          </p>
          <Link
            aria-label="Add trip item"
            className="grid h-11 w-11 place-items-center rounded-full bg-transparent text-orange-400"
            href={`/dashboard/trips/${tripId}/timeline#new-plan`}
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function MobileActivityRow({
  anchorPoint,
  disabled,
  locale,
  onDismiss,
  onOpenDetail,
  onSave,
  row,
  tripId
}: {
  anchorPoint: GeoPoint | null;
  disabled: boolean;
  locale: string;
  onDismiss: (row: Extract<ActivityRow, { type: "recommendation" }>) => void;
  onOpenDetail: (row: ActivityRow) => void;
  onSave: (row: Extract<ActivityRow, { type: "recommendation" }>) => void;
  row: ActivityRow;
  tripId: string;
}) {
  const icon = categoryIcon(row.category);
  const title = row.title;
  const detail = mobileRowDetail(row, anchorPoint, locale);
  const sideLabel = mobileRowSideLabel(row);
  const added = row.type === "place";
  const canOpenDetail = row.type === "recommendation" || row.type === "place";

  return (
    <article className="py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={["relative grid h-12 w-12 shrink-0 place-items-center rounded-full", categoryIconClass(row.category)].join(" ")}>
          {icon}
          {added ? (
            <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-[0.6rem] font-black text-white ring-2 ring-[#1f1f21]">
              ✓
            </span>
          ) : null}
        </span>
        <button
          aria-label={canOpenDetail ? `Details for ${title}` : `Plan ${title}`}
          className="min-w-0 flex-1 text-left"
          onClick={() => {
            if (canOpenDetail) {
              onOpenDetail(row);
            }
          }}
          type="button"
        >
          <span className="flex min-w-0 items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-base font-black leading-tight text-white">{title}</span>
              <span className="mt-1 block truncate text-sm font-semibold text-white/48">
                {detail.distance ? (
                  <>
                    <span className="text-orange-400">{detail.distance}</span>
                    {detail.text ? " · " : ""}
                  </>
                ) : null}
                {detail.text}
              </span>
            </span>
            {sideLabel ? (
              <span className="shrink-0 whitespace-pre-line text-right text-sm font-bold leading-tight text-white/48">
                {sideLabel}
              </span>
            ) : null}
          </span>
        </button>
        {row.type === "recommendation" ? (
          <button
            aria-label={`Save ${title}`}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-500/14 text-orange-400 disabled:opacity-60"
            disabled={disabled}
            onClick={() => onSave(row)}
            type="button"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : row.type === "activity" || row.type === "needs-location" ? (
          <Link
            aria-label={row.type === "activity" ? `Add ${title} to itinerary` : `Add location for ${title}`}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/8 text-white/60"
            href={`/dashboard/trips/${tripId}/timeline#new-plan`}
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function mobileRowDetail(row: ActivityRow, anchorPoint: GeoPoint | null, locale: string) {
  const distance = getDistanceLabel(row, anchorPoint, locale);
  if (row.type === "recommendation") {
    return {
      distance,
      text: [row.ratingLabel ? `${row.ratingLabel} ★` : null, row.address || row.meta]
        .filter(Boolean)
        .join(" · ")
    };
  }

  if (row.type === "place") {
    return {
      distance,
      text: [row.address || row.meta].filter(Boolean).join(" · ")
    };
  }

  return {
    distance: null,
    text: [row.location, row.status, row.description].filter(Boolean).join(" · ")
  };
}

function mobileRowSideLabel(row: ActivityRow) {
  if (row.type !== "place") return null;

  const schedule = formatMobileActivitySchedule(row.startTime, row.hasStartTime);
  if (schedule) return schedule;

  const labels = row.meta.split(" · ").map((part) => part.trim()).filter(Boolean);
  return labels.length ? labels.slice(0, 2).join("\n") : null;
}

function hasActivityCoordinates(row: ActivityRow) {
  return getActivityCoordinates(row) !== null;
}

function getActivityCoordinates(row: ActivityRow): GeoPoint | null {
  if (row.type !== "place" && row.type !== "recommendation") return null;
  if (typeof row.lat !== "number" || typeof row.lng !== "number") return null;
  return { lat: row.lat, lng: row.lng };
}

function getDistanceLabel(row: ActivityRow, anchorPoint: GeoPoint | null, locale: string) {
  const coordinates = getActivityCoordinates(row);
  if (!coordinates || !anchorPoint) return null;
  return formatDistance(haversineDistanceKm(anchorPoint, coordinates), locale);
}

function getActivityCity(row: ActivityRow) {
  const source =
    row.type === "recommendation" || row.type === "place"
      ? row.address || row.meta
      : row.location;
  if (!source) return null;

  const parts = source
    .replace(/\s+/g, " ")
    .trim()
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 3) return stripPostalCode(parts[parts.length - 2]);
  if (parts.length === 2) return stripPostalCode(parts[0]);
  return null;
}

function stripPostalCode(value: string) {
  return value.replace(/\s+\d{4,}(?:-\d+)?$/, "").trim();
}

function formatMobileActivitySchedule(value: string | null, hasTime?: boolean) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short"
  }).format(date);

  if (!hasTime) return dateLabel;

  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC"
  }).format(date);

  return `${dateLabel}\n${timeLabel}`;
}

function categoryIconClass(category: ActivityFilterId) {
  if (category === "food") return "bg-orange-500/18 text-orange-300";
  if (category === "nightlife") return "bg-amber-500/18 text-amber-300";
  if (category === "lodging") return "bg-violet-500/18 text-violet-300";
  if (category === "activities") return "bg-fuchsia-500/18 text-fuchsia-300";
  if (category === "shopping") return "bg-rose-500/18 text-rose-300";
  if (category === "places") return "bg-blue-500/18 text-blue-300";
  return "bg-orange-500/18 text-orange-300";
}

function buildMobileActivityMapItems(
  items: TripMapData["items"],
  rows: ActivityRow[]
): TripMapItem[] {
  const savedPlaces: TripMapItem[] = items.map((item, index) => ({
    ...item,
    routeOrder: item.routeOrder || index + 1
  }));
  const savedIds = new Set(savedPlaces.map((item) => item.id));
  const recommendations = rows
    .filter((row): row is Extract<ActivityRow, { type: "recommendation" }> => row.type === "recommendation")
    .filter((row) => !savedIds.has(row.id))
    .slice(0, Math.max(8 - savedPlaces.length, 0))
    .flatMap((row, index): TripMapItem[] => {
      if (typeof row.lat !== "number" || typeof row.lng !== "number") return [];

      return [{
        address: row.address,
        bookingUrl: row.bookingUrl,
        category: row.category,
        dayLabel: "Idea",
        id: row.id,
        imageAlt: row.imageAlt,
        imageAttribution: row.imageAttribution,
        imageUrl: row.imageUrl,
        lat: row.lat,
        lng: row.lng,
        provider: row.provider,
        routeOrder: savedPlaces.length + index + 1,
        status: "suggested",
        timeLabel: row.ratingLabel ? `${row.ratingLabel} stars` : null,
        title: row.title
      }];
    });

  return [...savedPlaces, ...recommendations];
}

function ActivitySection({
  action,
  children,
  title
}: {
  action?: ReactNode;
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="grid gap-2 rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">{title}</h3>
        {action}
      </div>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

function RecommendationRow({
  disabled,
  onDismiss,
  onSave,
  row
}: {
  disabled: boolean;
  onDismiss: () => void;
  onSave: () => void;
  row: Extract<ActivityRow, { type: "recommendation" }>;
}) {
  const icon = categoryIcon(row.category);

  return (
    <article className="grid gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-blue-700 ring-1 ring-slate-200">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 gap-3">
            <PlacePhoto
              alt={row.imageAlt || `Photo of ${row.title}`}
              attribution={row.imageAttribution}
              className="h-14 w-14 shrink-0 rounded-2xl"
              fallbackLabel={row.meta}
              src={row.imageUrl}
            />
            <div className="min-w-0">
              <h4 className="truncate text-base font-black text-slate-950">{row.title}</h4>
              <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
                {[row.meta, row.ratingLabel ? `${row.ratingLabel} ★` : null].filter(Boolean).join(" · ")}
              </p>
              {row.reason ? (
                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-600">{row.reason}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-blue-600 px-4 text-xs font-black text-white disabled:opacity-60"
          disabled={disabled}
          onClick={onSave}
          type="button"
        >
          Save to Trip
        </button>
        {row.bookingUrl ? (
          <a
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-full bg-white px-3 text-xs font-black text-slate-800 ring-1 ring-slate-200"
            href={row.bookingUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ) : null}
        <button
          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-full bg-white px-3 text-xs font-black text-slate-700 ring-1 ring-slate-200 disabled:opacity-60"
          disabled={disabled}
          onClick={onDismiss}
          type="button"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Dismiss
        </button>
      </div>
    </article>
  );
}

function SavedPlaceRow({ row }: { row: Extract<ActivityRow, { type: "place" }> }) {
  return (
    <article className="grid gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-100">
          {categoryIcon(row.category)}
        </span>
        <PlacePhoto
          alt={row.imageAlt || `Photo of ${row.title}`}
          attribution={row.imageAttribution}
          className="h-14 w-14 shrink-0 rounded-2xl"
          fallbackLabel={row.meta}
          src={row.imageUrl}
        />
        <div className="min-w-0">
          <h4 className="truncate text-base font-black text-slate-950">{row.title}</h4>
          <p className="mt-0.5 truncate text-xs font-bold text-slate-500">{row.meta}</p>
          {row.address ? (
            <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-600">{row.address}</p>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-3 text-xs font-black text-slate-800 ring-1 ring-slate-200"
          href={row.ctaHref}
        >
          {row.ctaLabel}
        </Link>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-3 text-xs font-black text-white"
          href={row.secondaryHref}
        >
          {row.secondaryLabel}
        </Link>
      </div>
    </article>
  );
}

function StatusRow({
  row,
  tripId
}: {
  row: Extract<ActivityRow, { type: "activity" | "needs-location" }>;
  tripId: string;
}) {
  const activity = row.type === "activity";

  return (
    <article className="grid gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 gap-3">
        <span className={[
          "grid h-11 w-11 shrink-0 place-items-center rounded-full ring-1",
          activity ? "bg-violet-50 text-violet-700 ring-violet-100" : "bg-amber-50 text-amber-700 ring-amber-100"
        ].join(" ")}>
          {activity ? <Ticket className="h-4 w-4" aria-hidden="true" /> : <MapPin className="h-4 w-4" aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <h4 className="truncate text-base font-black text-slate-950">{row.title}</h4>
          <p className="mt-0.5 text-xs font-bold text-slate-500">{row.status}</p>
          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-600">{row.description}</p>
        </div>
      </div>
      <Link
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 text-xs font-black text-slate-800 ring-1 ring-slate-200"
        href={`/dashboard/trips/${tripId}/timeline#new-plan`}
      >
        {activity ? "Add to itinerary" : "Add location"}
      </Link>
    </article>
  );
}

function mapRecommendationRow(item: TripRecommendationView): ActivityRow {
  return {
    address: item.address,
    bookingUrl: item.bookingUrl,
    category: normalizeCategory(`${item.type} ${item.category} ${item.title} ${item.reason || ""}`),
    id: item.id,
    imageAlt: item.imageAlt,
    imageAttribution: item.imageAttribution,
    imageUrl: item.imageUrl,
    lat: item.lat,
    lng: item.lng,
    meta: [item.type, item.provider.replace("_", " ")].filter(Boolean).join(" · "),
    provider: item.provider,
    ratingLabel: item.ratingLabel,
    reason: item.reason,
    title: item.title,
    type: "recommendation"
  };
}

function mapPlaceRow(item: TripMapData["items"][number], tripId: string): ActivityRow {
  const meta = [
    "Mapped",
    item.dayLabel,
    item.timeLabel,
    item.category
  ].filter(Boolean).join(" · ");

  return {
    address: item.address || null,
    bookingUrl: item.bookingUrl || null,
    category: normalizeCategory(`${item.category} ${item.title}`),
    confirmationCode: item.confirmationCode || null,
    ctaHref: `/dashboard/trips/${tripId}/timeline#${item.id}`,
    ctaLabel: "Open in Itinerary",
    endTime: item.endTime || null,
    hasEndTime: item.hasEndTime,
    hasStartTime: item.hasStartTime,
    id: item.id,
    imageAlt: item.imageAlt || null,
    imageAttribution: item.imageAttribution || null,
    imageUrl: item.imageUrl || null,
    kind: item.kind || item.category || null,
    lat: item.lat,
    lng: item.lng,
    meta,
    notes: item.notes || null,
    provider: item.provider || null,
    providerMetadata: item.providerMetadata || null,
    providerPlaceId: item.providerPlaceId || null,
    secondaryHref: `/dashboard/trips/${tripId}/map#${item.id}`,
    secondaryLabel: "View on Map",
    source: null,
    startTime: item.startTime || null,
    status: item.status || "resolved",
    title: item.title,
    type: "place"
  };
}

function mapActivityRow(segment: UnmappedMapSegment): ActivityRow {
  return {
    category: "activities",
    description: "Add a meeting point or provider before this appears on your map.",
    id: segment.id,
    location: segment.location,
    status: "Activity idea",
    title: segment.title,
    type: "activity"
  };
}

function mapNeedsLocationRow(segment: UnmappedMapSegment): ActivityRow {
  return {
    category: "places",
    description: "Confirm a location before this appears on your map.",
    id: segment.id,
    location: segment.location,
    status: "Needs location",
    title: segment.title,
    type: "needs-location"
  };
}

function normalizeCategory(value: string): ActivityFilterId {
  const text = value.toLowerCase().replace(/[_-]+/g, " ");
  if (/\b(hotel|lodging|stay|inn|resort)\b/.test(text)) return "lodging";
  if (/\b(nightlife|club|lounge|cocktail|evening|late night|bar)\b/.test(text)) return "nightlife";
  if (/\b(shopping|shop|mall|store|market|boutique|retail|centre|center)\b/.test(text)) return "shopping";
  if (/\b(restaurant|food|meal|cafe|coffee|bakery|brunch|dinner|lunch|breakfast|sushi|tapas)\b/.test(text)) {
    return "food";
  }
  if (/\b(activity|tour|experience|entertainment|excursion|boat|guided|class|meeting)\b/.test(text)) return "activities";
  return "places";
}

function categoryIcon(category: ActivityFilterId) {
  if (category === "food") return <Utensils className="h-4 w-4" aria-hidden="true" />;
  if (category === "activities") return <Ticket className="h-4 w-4" aria-hidden="true" />;
  if (category === "shopping") return <ShoppingBag className="h-4 w-4" aria-hidden="true" />;
  if (category === "nightlife") return <Moon className="h-4 w-4" aria-hidden="true" />;
  if (category === "lodging") return <Bed className="h-4 w-4" aria-hidden="true" />;
  if (category === "all") return <Sparkles className="h-4 w-4" aria-hidden="true" />;
  return <MapIcon className="h-4 w-4" aria-hidden="true" />;
}

function toActivityDetailTarget(row: ActivityRow | null) {
  if (!row) return null;

  if (row.type === "recommendation") {
    const item: ActivityDetailRecommendation = {
      address: row.address,
      bookingUrl: row.bookingUrl,
      category: row.category,
      id: row.id,
      imageAlt: row.imageAlt,
      imageAttribution: row.imageAttribution,
      imageUrl: row.imageUrl,
      lat: row.lat,
      lng: row.lng,
      meta: row.meta,
      provider: row.provider,
      ratingLabel: row.ratingLabel,
      reason: row.reason,
      title: row.title,
      type: row.category
    };
    return { item, type: "recommendation" as const };
  }

  if (row.type === "place") {
    const item: TripMapItem = {
      address: row.address,
      bookingUrl: row.bookingUrl,
      category: row.category,
      confirmationCode: row.confirmationCode,
      dayLabel: null,
      endTime: row.endTime,
      hasEndTime: row.hasEndTime,
      hasStartTime: row.hasStartTime,
      id: row.id,
      imageAlt: row.imageAlt,
      imageAttribution: row.imageAttribution,
      imageUrl: row.imageUrl,
      kind: row.kind,
      lat: row.lat,
      lng: row.lng,
      notes: row.notes,
      provider: row.provider,
      providerMetadata: row.providerMetadata,
      providerPlaceId: row.providerPlaceId,
      routeOrder: null,
      startTime: row.startTime,
      status: row.status,
      timeLabel: null,
      title: row.title
    };
    return { item, type: "segment" as const };
  }

  return null;
}

function readError(payload: unknown, status: number) {
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

  return `Request failed (${status}).`;
}
