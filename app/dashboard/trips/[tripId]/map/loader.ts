import "server-only";

import type { TripMapItem } from "@/components/TripMap";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { enrichTripSegmentPhotos } from "@/lib/server/trip-segment-photo-enrichment";
import { resolveUnmappedPhysicalTripSegments } from "@/lib/server/trip-segment-location-resolution";
import { listTripRecommendations } from "@/lib/server/travel-recommendations";
import { isDemoTripId, isUuid } from "@/lib/server/trip-id";
import { buildPlacePhotoUrl, readProviderPhoto } from "@/lib/travel-data/photo-url";
import {
  hasResolvedRoute,
  isRouteKind,
  readTripSegmentRoute,
  routeLocationLabel,
  routeTitleLabel
} from "@/lib/trip-segment-route";

export type TripMapData = {
  destination: string | null;
  error: string | null;
  items: TripMapItem[];
  recommendations: TripRecommendationView[];
  searchUrl: string | null;
  tripId: string;
  activitySegments: UnmappedMapSegment[];
  unmappedCount: number;
  unmappedSegments: UnmappedMapSegment[];
};

export type UnmappedMapSegment = {
  id: string;
  location: string | null;
  locationStatus: string | null;
  safeRejectedAddress: string | null;
  title: string;
};

export type TripRecommendationView = {
  address: string | null;
  bookingUrl: string | null;
  category: string | null;
  id: string;
  imageAlt: string | null;
  imageAttribution: string | null;
  imageUrl: string | null;
  lat: number | null;
  lng: number | null;
  priceLabel: string | null;
  provider: string;
  ratingLabel: string | null;
  reason: string | null;
  status: string;
  title: string;
  type: string;
};

type TripRow = {
  destination: string | null;
  name?: string | null;
  title?: string | null;
};

type TripSegmentMapRow = {
  booking_url: string | null;
  confirmation_code: string | null;
  end_time: string | null;
  inserted_at: string | null;
  kind: string | null;
  id: string;
  lat: number | null;
  lng: number | null;
  location: string | null;
  location_status: string | null;
  notes: string | null;
  position: number | null;
  provider: string | null;
  provider_metadata: Record<string, unknown> | null;
  provider_place_id: string | null;
  start_time: string | null;
  title: string;
};

const demoItems: TripMapItem[] = [
  { id: "bcn-airport", category: "transportation", lat: 41.2974, lng: 2.0833, routeOrder: 1, status: "resolved", title: "Barcelona-El Prat Airport" },
  { id: "hotel-arts", category: "hotel", lat: 41.3864, lng: 2.1963, routeOrder: 2, status: "resolved", title: "Hotel Arts Barcelona" },
  { id: "el-born-dinner", category: "restaurant", lat: 41.3839, lng: 2.1823, routeOrder: 3, status: "resolved", title: "Team dinner in El Born" },
  { id: "fira-meeting", category: "meeting", lat: 41.3547, lng: 2.1287, routeOrder: 4, status: "resolved", title: "Fira Barcelona meeting" }
];

export async function loadTripMapData(tripId: string): Promise<TripMapData> {
  if (isDemoTripId(tripId)) {
    return {
      destination: "Barcelona, Spain",
      error: null,
      items: demoItems,
      recommendations: [],
      searchUrl: googleMapsSearchUrl("Barcelona, Spain"),
      tripId,
      activitySegments: [],
      unmappedCount: 0,
      unmappedSegments: []
    };
  }

  if (!isUuid(tripId)) {
    return emptyMapData(tripId, "Invalid trip id.");
  }

  const auth = await authorizeDashboardApi();

  if (!auth) {
    return emptyMapData(tripId, "Sign in to load trip map data.");
  }

  const tripResult = await auth.supabase
    .from("trips")
    .select("destination,name,title")
    .eq("id", tripId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (tripResult.error) {
    return emptyMapData(tripId, "Could not load trip map data.");
  }

  if (!tripResult.data) {
    return emptyMapData(tripId, "Trip not found.");
  }

  const trip = tripResult.data as TripRow;
  await resolveUnmappedPhysicalTripSegments(auth.supabase as any, auth.userId, tripId, trip).catch(
    (error) => {
      console.info(
        JSON.stringify({
          area: "trip_segments",
          error: error instanceof Error ? error.message : "Unknown location retry failure.",
          event: "segment_location_retry_failed",
          tripId,
          userId: auth.userId
        })
      );
    }
  );
  await enrichTripSegmentPhotos(auth.supabase as any, auth.userId, tripId).catch((error) => {
    console.info(
      JSON.stringify({
        area: "trip_segments",
        error: error instanceof Error ? error.message : "Unknown photo enrichment failure.",
        event: "segment_photo_enrichment_failed",
        tripId,
        userId: auth.userId
      })
    );
  });

  const [itemResult, recommendationsResult] = await Promise.all([
    auth.supabase
      .from("trip_segments")
      .select("id,title,kind,location,lat,lng,location_status,provider,provider_metadata,provider_place_id,start_time,end_time,notes,confirmation_code,booking_url,position,inserted_at")
      .eq("trip_id", tripId)
      .eq("user_id", auth.userId)
      .order("start_time", { ascending: true, nullsFirst: false })
      .order("position", { ascending: true, nullsFirst: false })
      .order("inserted_at", { ascending: true }),
    listTripRecommendations(auth.supabase as any, auth.userId, tripId).catch(() => [])
  ]);

  if (itemResult.error) {
    return emptyMapData(tripId, "Could not load trip map data.");
  }

  const rows = (itemResult.data || []) as TripSegmentMapRow[];
  const mappedRows = sortRouteRows(rows.filter(isMappedRow));
  const unresolvedRows = rows.filter((row) => !isMappedRow(row));
  const activitySegments = unresolvedRows
    .filter((row) => isActivityIdea(row))
    .map(mapUnmappedSegment);
  const unmappedSegments = unresolvedRows
    .filter((row) => !isActivityIdea(row))
    .map(mapUnmappedSegment);

  return {
    destination: trip.destination,
    error: null,
    items: mappedRows.map(mapItem),
    recommendations: mapRecommendations(recommendationsResult),
    searchUrl: trip.destination ? googleMapsSearchUrl(trip.destination) : null,
    tripId,
    activitySegments,
    unmappedCount: unmappedSegments.length,
    unmappedSegments
  };
}

function emptyMapData(tripId: string, error: string): TripMapData {
  return {
    destination: null,
    error,
    items: [],
    recommendations: [],
    searchUrl: null,
    tripId,
    activitySegments: [],
    unmappedCount: 0,
    unmappedSegments: []
  };
}

function mapUnmappedSegment(row: TripSegmentMapRow): UnmappedMapSegment {
  const diagnostics = isRecord(row.provider_metadata?.locationDiagnostics)
    ? row.provider_metadata.locationDiagnostics
    : null;
  const route = readTripSegmentRoute(row.provider_metadata);
  return {
    id: row.id,
    location: route ? routeLocationLabel(route) || row.location : row.location,
    locationStatus: row.location_status || null,
    safeRejectedAddress:
      typeof diagnostics?.selectedFormattedAddress === "string"
        ? diagnostics.selectedFormattedAddress
        : null,
    title: route ? routeTitleLabel(route, row.title || "Trip route") : row.title || "Trip stop"
  };
}

function isActivityIdea(row: TripSegmentMapRow) {
  if (isRouteKind(row.kind) || readTripSegmentRoute(row.provider_metadata)) {
    return false;
  }
  const metadata = isRecord(row.provider_metadata) ? row.provider_metadata : {};
  const text = `${row.title || ""} ${row.location || ""} ${row.location_status || ""}`.toLowerCase();
  return (
    row.location_status === "needs_activity_provider" ||
    metadata.activityCandidate === true ||
    /\b(boat tour|tour|cruise|guided|excursion|experience|meeting point|provider)\b/.test(text)
  );
}

function isMappedRow(row: TripSegmentMapRow) {
  const route = readTripSegmentRoute(row.provider_metadata);
  if (route || isRouteKind(row.kind)) {
    return hasResolvedRoute(route);
  }
  return typeof row.lat === "number" && typeof row.lng === "number";
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readScheduleFlag(metadata: Record<string, unknown> | null, key: "hasStartTime" | "hasEndTime") {
  const schedule = isRecord(metadata?.schedule) ? metadata.schedule : null;
  return schedule?.[key] === true;
}

function sanitizeMapProviderMetadata(metadata: Record<string, unknown> | null) {
  if (!isRecord(metadata)) return null;

  const safe: Record<string, unknown> = {};
  const route = readTripSegmentRoute(metadata);
  if (route) safe.route = route;

  if (isRecord(metadata.schedule)) {
    safe.schedule = {
      hasEndTime: metadata.schedule.hasEndTime === true,
      hasStartTime: metadata.schedule.hasStartTime === true,
      timeZone: typeof metadata.schedule.timeZone === "string" ? metadata.schedule.timeZone : null
    };
  }

  return Object.keys(safe).length ? safe : null;
}

function mapItem(row: TripSegmentMapRow, index: number): TripMapItem {
  const photo = readProviderPhoto(row.provider_metadata);
  const route = readTripSegmentRoute(row.provider_metadata);
  const routeReady = hasResolvedRoute(route);
  const lat = routeReady ? route?.destination?.lat : row.lat;
  const lng = routeReady ? route?.destination?.lng : row.lng;
  return {
    address: route ? routeLocationLabel(route) || row.location : row.location,
    bookingUrl: row.booking_url,
    category: route?.mode || row.kind,
    confirmationCode: row.confirmation_code,
    dayLabel: formatMapDayLabel(row.start_time),
    endTime: row.end_time,
    hasEndTime: readScheduleFlag(row.provider_metadata, "hasEndTime"),
    hasStartTime: readScheduleFlag(row.provider_metadata, "hasStartTime"),
    id: row.id,
    imageAlt: photo?.imageAlt || null,
    imageAttribution: photo?.attribution || null,
    imageUrl: buildPlacePhotoUrl(row.provider_metadata, 400),
    kind: row.kind,
    lat: Number(lat),
    lng: Number(lng),
    notes: row.notes,
    provider: row.provider,
    providerMetadata: sanitizeMapProviderMetadata(row.provider_metadata),
    providerPlaceId: row.provider_place_id,
    route,
    routeOrder: index + 1,
    startTime: row.start_time,
    status: row.location_status || "resolved",
    timeLabel: formatMapTimeLabel(row.start_time),
    title: route
      ? routeTitleLabel(route, row.title || "Trip route")
      : row.title || row.location || "Trip stop"
  };
}

function sortRouteRows(rows: TripSegmentMapRow[]) {
  return [...rows].sort((a, b) => {
    const timeCompare = sortableTime(a.start_time).localeCompare(sortableTime(b.start_time));
    if (timeCompare !== 0) return timeCompare;

    const positionCompare = sortableNumber(a.position) - sortableNumber(b.position);
    if (positionCompare !== 0) return positionCompare;

    return sortableTime(a.inserted_at).localeCompare(sortableTime(b.inserted_at));
  });
}

function sortableTime(value: string | null) {
  return value || "9999-12-31T23:59:59.999Z";
}

function sortableNumber(value: number | null) {
  return typeof value === "number" ? value : Number.MAX_SAFE_INTEGER;
}

function formatMapDayLabel(value: string | null) {
  if (!value) return "Unscheduled";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
}

function formatMapTimeLabel(value: string | null) {
  if (!value) return "Anytime";
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC"
  }).format(new Date(value));
}

function googleMapsSearchUrl(value: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
}

function mapRecommendations(value: unknown): TripRecommendationView[] {
  return (Array.isArray(value) ? value : []).map((row: any) => {
    const inventory = Array.isArray(row.travel_inventory)
      ? row.travel_inventory[0]
      : row.travel_inventory;

    const metadata = isRecord(inventory?.metadata) ? inventory.metadata : null;
    const photo = readProviderPhoto(metadata);

    return {
      address: inventory?.address || null,
      bookingUrl: inventory?.booking_url || inventory?.source_url || null,
      category: inventory?.category || null,
      id: row.id,
      imageAlt: inventory?.image_alt || photo?.imageAlt || null,
      imageAttribution: inventory?.image_attribution || photo?.attribution || null,
      imageUrl: inventory?.image_url || buildPlacePhotoUrl(metadata, 800),
      lat: typeof inventory?.latitude === "number" ? inventory.latitude : null,
      lng: typeof inventory?.longitude === "number" ? inventory.longitude : null,
      priceLabel:
        typeof inventory?.price_from === "number"
          ? `${inventory.currency || "USD"} ${inventory.price_from}`
          : null,
      provider: inventory?.provider || "wayline",
      ratingLabel:
        typeof inventory?.rating === "number"
          ? `${inventory.rating.toFixed(1)}${inventory.review_count ? ` (${inventory.review_count})` : ""}`
          : null,
      reason: row.reason || null,
      status: row.status || "suggested",
      title: inventory?.title || "Suggested stop",
      type: inventory?.type || row.recommendation_type || "activity"
    };
  });
}
