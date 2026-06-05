"use client";

import Link from "next/link";
import {
  Bed,
  ExternalLink,
  Loader2,
  Map,
  MapPin,
  Moon,
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
import { PlacePhoto } from "@/components/place-photo";

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
      category: ActivityFilterId;
      ctaHref: string;
      ctaLabel: string;
      imageAlt: string | null;
      imageAttribution: string | null;
      imageUrl: string | null;
      meta: string;
      secondaryHref: string;
      secondaryLabel: string;
      source: string | null;
      status: string;
      title: string;
      type: "place";
    }
  | {
      bookingUrl: string | null;
      category: ActivityFilterId;
      id: string;
      imageAlt: string | null;
      imageAttribution: string | null;
      imageUrl: string | null;
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
  const [message, setMessage] = useState("");
  const basePlace = items[0] || null;
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
  const showFilters = discoveryRows.length >= 5;
  const filteredDiscoveryRows =
    !showFilters || activeFilter === "all"
      ? discoveryRows
      : discoveryRows.filter((row) => row.category === activeFilter);
  const recommendationsForFilter = filteredDiscoveryRows.filter((row) => row.type === "recommendation");
  const savedPlacesForFilter = rows.filter((row) => row.type === "place");
  const activityIdeasForFilter = filteredDiscoveryRows.filter((row) => row.type === "activity");
  const needsLocationForFilter = filteredDiscoveryRows.filter((row) => row.type === "needs-location");
  const activeLabel = filters.find((filter) => filter.id === activeFilter)?.label || "selected";

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
    <div className="grid min-w-0 gap-4" data-testid="trip-ideas-page">
      {error ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {error}
        </p>
      ) : null}

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
              Ideas
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">All trip activities</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              Review saved ideas, nearby suggestions, and places you may want to add to your itinerary.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Ideas near your route
            </p>
            <p className="mt-1 text-sm font-bold text-slate-950">
              {items.length} mapped place{items.length === 1 ? "" : "s"}
            </p>
            <p className="mt-1 truncate text-xs font-semibold text-slate-500">
              {basePlace ? `Show distance from ${basePlace.title}` : "Add a mapped place to unlock route context."}
            </p>
            <Link
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-white px-3 text-xs font-black text-slate-800 ring-1 ring-slate-200"
              href={`/dashboard/trips/${tripId}/map`}
            >
              Open map
            </Link>
          </div>
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

      {recommendationsForFilter.length || activeFilter === "all" ? (
        <ActivitySection
          action={
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-slate-950 px-3 text-xs font-black text-white disabled:opacity-60"
              disabled={Boolean(pendingAction) || items.length === 0}
              onClick={() => run(`/api/trips/${tripId}/generate-suggestions`, "Finding ideas")}
              type="button"
            >
              {pendingAction?.includes("generate-suggestions") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Find ideas
            </button>
          }
          title="Nearby Ideas"
        >
          {recommendationsForFilter.length ? recommendationsForFilter.map((row) =>
            row.type === "recommendation" ? (
              <RecommendationRow
                disabled={Boolean(pendingAction)}
                key={row.id}
                onDismiss={() => run(`/api/trip-recommendations/${row.id}/dismiss`, "Dismissing idea")}
                onSave={() => run(`/api/trip-recommendations/${row.id}/save`, "Saving idea")}
                row={row}
              />
            ) : null
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-black text-slate-950">No nearby ideas yet.</p>
              <p className="mt-1 leading-6">
                Find restaurants, places, and activities near your mapped route.
              </p>
            </div>
          )}
        </ActivitySection>
      ) : null}

      {savedPlacesForFilter.length ? (
        <ActivitySection title="Route places">
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
  );
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
    bookingUrl: item.bookingUrl,
    category: normalizeCategory(`${item.type} ${item.category} ${item.title} ${item.reason || ""}`),
    id: item.id,
    imageAlt: item.imageAlt,
    imageAttribution: item.imageAttribution,
    imageUrl: item.imageUrl,
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
    category: normalizeCategory(`${item.category} ${item.title}`),
    ctaHref: `/dashboard/trips/${tripId}/timeline#${item.id}`,
    ctaLabel: "Open in Itinerary",
    imageAlt: item.imageAlt || null,
    imageAttribution: item.imageAttribution || null,
    imageUrl: item.imageUrl || null,
    meta,
    secondaryHref: `/dashboard/trips/${tripId}/map#${item.id}`,
    secondaryLabel: "View on Map",
    source: null,
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
  return <Map className="h-4 w-4" aria-hidden="true" />;
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
