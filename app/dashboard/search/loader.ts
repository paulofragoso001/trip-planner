import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { buildPlacePhotoUrl } from "@/lib/travel-data/photo-url";
import { readTripSegmentRoute, routeEndpointLabel } from "@/lib/trip-segment-route";
import type { SearchData, SearchResultIcon, SearchResultView } from "./types";

type TripRow = {
  destination: string | null;
  end_date: string | null;
  id: string;
  name: string | null;
  start_date: string | null;
  status: string | null;
};

type TripSegmentRow = {
  id: string;
  inserted_at: string | null;
  kind: string | null;
  location: string | null;
  provider: string | null;
  provider_metadata: Record<string, unknown> | null;
  start_time: string | null;
  title: string | null;
  trip_id: string;
};

type SavedIdeaRow = {
  address: string | null;
  category: string | null;
  city: string | null;
  country: string | null;
  created_at: string | null;
  description: string | null;
  id: string;
  name: string | null;
  region: string | null;
  status: string | null;
  travel_note: string | null;
  trip_id: string | null;
};

type DocumentRow = {
  created_at: string | null;
  date_time: string | null;
  id: string;
  location: string | null;
  notes: string | null;
  source_label: string | null;
  source_type: string | null;
  title: string | null;
  trip_id: string | null;
};

export type UnifiedSearchResultType = "activity" | "document" | "place" | "trip";

export type UnifiedSearchResult = {
  href: string;
  id: string;
  subtitle: string | null;
  title: string;
  type: UnifiedSearchResultType;
  updated_at: string | null;
};

export type UnifiedSearchResponse = {
  meta: {
    processing_time_ms: number;
    total_results: number;
  };
  query: string;
  results: UnifiedSearchResult[];
};

export async function loadSearchData(initialQuery = ""): Promise<SearchData> {
  noStore();

  const auth = await authorizeDashboardApi<SupabaseClient>();
  if (!auth) {
    return emptySearchData(initialQuery, "Sign in to search your trips.");
  }

  const supabase = auth.supabase;

  const [trips, segments, savedIdeas, documents] = await Promise.all([
    loadTrips(supabase, auth.userId),
    loadTripSegments(supabase, auth.userId),
    loadSavedIdeas(supabase, auth.userId),
    loadDocuments(supabase, auth.userId)
  ]);

  return {
    documents: documents.map(mapDocument),
    error: null,
    initialQuery,
    savedIdeas: savedIdeas.map(mapSavedIdea),
    tripItems: [...trips.map(mapTrip), ...segments.map(mapTripSegment)]
  };
}

export async function loadUnifiedSearchResults(query: string): Promise<UnifiedSearchResponse> {
  const startedAt = Date.now();
  const normalizedQuery = query.trim().toLowerCase().slice(0, 120);

  if (normalizedQuery.length < 2) {
    return {
      meta: {
        processing_time_ms: Date.now() - startedAt,
        total_results: 0
      },
      query,
      results: []
    };
  }

  const data = await loadSearchData(normalizedQuery);
  const results = dedupeSearchResults([
    ...data.tripItems,
    ...data.savedIdeas,
    ...data.documents
  ])
    .filter((result) => resultMatchesQuery(result, normalizedQuery))
    .slice(0, 24)
    .map(mapUnifiedSearchResult);

  return {
    meta: {
      processing_time_ms: Date.now() - startedAt,
      total_results: results.length
    },
    query,
    results
  };
}

function emptySearchData(initialQuery: string, error: string | null): SearchData {
  return {
    documents: [],
    error,
    initialQuery,
    savedIdeas: [],
    tripItems: []
  };
}

async function loadTrips(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("trips")
    .select("id,name,destination,start_date,end_date,status")
    .eq("user_id", userId)
    .order("start_date", { ascending: false, nullsFirst: false })
    .limit(24);

  if (error) {
    logSearchSourceError("trips", error);
    return [];
  }

  return (data ?? []) as unknown as TripRow[];
}

async function loadTripSegments(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("trip_segments")
    .select("id,trip_id,kind,title,location,start_time,provider,provider_metadata,inserted_at")
    .eq("user_id", userId)
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("inserted_at", { ascending: false })
    .limit(48);

  if (error) {
    logSearchSourceError("trip_segments", error);
    return [];
  }

  return (data ?? []) as unknown as TripSegmentRow[];
}

async function loadSavedIdeas(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("extracted_places")
    .select("id,trip_id,name,category,description,travel_note,address,city,region,country,status,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    logSearchSourceError("extracted_places", error);
    return [];
  }

  return (data ?? []) as unknown as SavedIdeaRow[];
}

async function loadDocuments(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("unfiled_items")
    .select("id,trip_id,source_type,source_label,title,location,date_time,notes,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    logSearchSourceError("unfiled_items", error);
    return [];
  }

  return (data ?? []) as unknown as DocumentRow[];
}

function mapTrip(trip: TripRow): SearchResultView {
  const title = readString(trip.name) || readString(trip.destination) || "Untitled trip";
  const subtitle = readString(trip.destination);
  const meta = [formatDateRange(trip.start_date, trip.end_date), readString(trip.status)]
    .filter(Boolean)
    .join(" · ");

  return {
    href: `/dashboard/trips/${encodeURIComponent(trip.id)}`,
    icon: "trip",
    id: `trip-${trip.id}`,
    imageAlt: null,
    imageUrl: null,
    meta: meta || null,
    metaPrimary: formatDateRange(trip.start_date, trip.end_date),
    metaSecondary: readString(trip.status),
    searchText: buildSearchText(title, subtitle, meta),
    subtitle,
    title
  };
}

function mapTripSegment(segment: TripSegmentRow): SearchResultView {
  const route = readTripSegmentRoute(segment.provider_metadata);
  const routeOrigin = routeEndpointLabel(route?.origin);
  const routeDestination = routeEndpointLabel(route?.destination);
  const routeTitle = routeOrigin && routeDestination ? `${routeOrigin} → ${routeDestination}` : null;
  const title = routeTitle || readString(segment.title) || "Untitled trip item";
  const imageUrl = buildPlacePhotoUrl(segment.provider_metadata, 160);
  const provider = readString(segment.provider);
  const routeDetails = [readString(route?.carrier), readString(route?.flightNumber)]
    .filter(Boolean)
    .join(" ");
  const subtitle = [
    routeDetails || null,
    readString(segment.location),
    provider
  ]
    .filter(Boolean)
    .join(" · ");
  const dateTime = formatDateTimeParts(segment.start_time) || formatDateTimeParts(segment.inserted_at);
  const meta = [dateTime?.dateLabel, dateTime?.timeLabel].filter(Boolean).join(" · ");

  return {
    href: `/dashboard/trips/${encodeURIComponent(segment.trip_id)}/timeline`,
    icon: iconForKind(segment.kind),
    id: `segment-${segment.id}`,
    imageAlt: imageUrl ? `Photo of ${title}` : null,
    imageUrl,
    meta: meta || null,
    metaPrimary: dateTime?.dateLabel ?? null,
    metaSecondary: dateTime?.timeLabel ?? null,
    searchText: buildSearchText(
      title,
      subtitle,
      meta,
      segment.kind,
      routeOrigin,
      routeDestination,
      route?.carrier,
      route?.flightNumber,
      route?.confirmation
    ),
    subtitle: subtitle || null,
    title
  };
}

function mapSavedIdea(idea: SavedIdeaRow): SearchResultView {
  const title = readString(idea.name) || "Saved idea";
  const location = [idea.address, idea.city, idea.region, idea.country]
    .map(readString)
    .filter(Boolean)
    .join(", ");
  const subtitle =
    [readString(idea.category), location || readString(idea.description) || readString(idea.travel_note)]
      .filter(Boolean)
      .join(" · ") || null;
  const meta = [readString(idea.status), formatDateTime(idea.created_at)].filter(Boolean).join(" · ");

  return {
    href: idea.trip_id
      ? `/dashboard/trips/${encodeURIComponent(idea.trip_id)}/ideas`
      : "/dashboard/plan",
    icon: "idea",
    id: `idea-${idea.id}`,
    imageAlt: null,
    imageUrl: null,
    meta: meta || null,
    metaPrimary: readString(idea.status),
    metaSecondary: formatDateTime(idea.created_at),
    searchText: buildSearchText(title, subtitle, meta, idea.description, idea.travel_note),
    subtitle,
    title
  };
}

function mapDocument(document: DocumentRow): SearchResultView {
  const title =
    readString(document.title) ||
    readString(document.source_label) ||
    labelize(document.source_type) ||
    "Trip document";
  const subtitle =
    [readString(document.location), readString(document.notes), labelize(document.source_type)]
      .filter(Boolean)
      .join(" · ") || null;
  const meta = formatDateTime(document.date_time) || formatDateTime(document.created_at);

  return {
    href: document.trip_id
      ? `/dashboard/trips/${encodeURIComponent(document.trip_id)}/documents`
      : "/dashboard/trips",
    icon: "document",
    id: `document-${document.id}`,
    imageAlt: null,
    imageUrl: null,
    meta,
    metaPrimary: formatDateTime(document.date_time) || formatDateTime(document.created_at),
    metaSecondary: labelize(document.source_type),
    searchText: buildSearchText(title, subtitle, meta, document.source_label, document.source_type),
    subtitle,
    title
  };
}

function iconForKind(kind: string | null): SearchResultIcon {
  const normalized = kind?.toLowerCase() ?? "";
  if (normalized.includes("flight")) return "flight";
  if (normalized.includes("hotel") || normalized.includes("lodging")) return "hotel";
  if (normalized.includes("restaurant") || normalized.includes("food")) return "restaurant";
  if (normalized.includes("activity") || normalized.includes("tour")) return "activity";
  return "place";
}

function formatDateRange(start: string | null, end: string | null) {
  const startLabel = formatDateOnly(start);
  const endLabel = formatDateOnly(end);
  if (startLabel && endLabel && startLabel !== endLabel) return `${startLabel} - ${endLabel}`;
  return startLabel || endLabel || null;
}

function formatDateOnly(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  }).format(date);
}

function formatDateTimeParts(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    dateLabel: new Intl.DateTimeFormat("en", {
      day: "2-digit",
      month: "short",
      weekday: "short"
    }).format(date),
    timeLabel: new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit"
    }).format(date)
  };
}

function buildSearchText(...parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function resultMatchesQuery(result: SearchResultView, normalizedQuery: string) {
  return [
    result.searchText,
    result.title,
    result.subtitle,
    result.meta,
    result.metaPrimary,
    result.metaSecondary
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function dedupeSearchResults(results: SearchResultView[]) {
  const seen = new Set<string>();

  return results.filter((result) => {
    const key = `${result.href}-${result.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapUnifiedSearchResult(result: SearchResultView): UnifiedSearchResult {
  return {
    href: result.href,
    id: result.id,
    subtitle: result.subtitle,
    title: result.title,
    type: unifiedTypeForResult(result),
    updated_at: result.metaPrimary || result.meta || null
  };
}

function unifiedTypeForResult(result: SearchResultView): UnifiedSearchResultType {
  if (result.id.startsWith("trip-")) return "trip";
  if (result.id.startsWith("document-")) return "document";
  if (result.id.startsWith("idea-") || result.icon === "place") return "place";
  return "activity";
}

function labelize(value: string | null) {
  const clean = readString(value);
  if (!clean) return null;
  return clean
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function logSearchSourceError(source: string, error: { code?: string; message?: string }) {
  console.warn("[search] optional source unavailable", {
    code: error.code ?? "unknown",
    message: sanitizeErrorMessage(error.message),
    source
  });
}

function sanitizeErrorMessage(message: string | undefined) {
  if (!message) return "unknown";
  return message.replace(/([A-Z0-9_]*KEY|TOKEN|SECRET|PASSWORD)=\S+/gi, "$1=[redacted]");
}
