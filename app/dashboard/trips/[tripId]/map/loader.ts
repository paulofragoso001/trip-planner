import "server-only";

import type { TripMapItem } from "@/components/TripMap";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { resolveUnmappedPhysicalTripSegments } from "@/lib/server/trip-segment-location-resolution";
import { listTripRecommendations } from "@/lib/server/travel-recommendations";
import { isDemoTripId, isUuid } from "@/lib/server/trip-id";
import { buildPlacePhotoUrl, readProviderPhoto } from "@/lib/travel-data/photo-url";

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
  bookingUrl: string | null;
  category: string | null;
  id: string;
  imageAlt: string | null;
  imageAttribution: string | null;
  imageUrl: string | null;
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
  id: string;
  lat: number | null;
  lng: number | null;
  location: string | null;
  location_status: string | null;
  provider_metadata: Record<string, unknown> | null;
  title: string;
};

const demoItems: TripMapItem[] = [
  { id: "bcn-airport", lat: 41.2974, lng: 2.0833, title: "Barcelona-El Prat Airport" },
  { id: "hotel-arts", lat: 41.3864, lng: 2.1963, title: "Hotel Arts Barcelona" },
  { id: "el-born-dinner", lat: 41.3839, lng: 2.1823, title: "Team dinner in El Born" },
  { id: "fira-meeting", lat: 41.3547, lng: 2.1287, title: "Fira Barcelona meeting" }
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

  const [itemResult, recommendationsResult] = await Promise.all([
    auth.supabase
      .from("trip_segments")
      .select("id,title,location,lat,lng,location_status,provider_metadata")
      .eq("trip_id", tripId)
      .eq("user_id", auth.userId)
      .order("position", { ascending: true, nullsFirst: false })
      .order("start_time", { ascending: true, nullsFirst: false }),
    listTripRecommendations(auth.supabase as any, auth.userId, tripId).catch(() => [])
  ]);

  if (itemResult.error) {
    return emptyMapData(tripId, "Could not load trip map data.");
  }

  const rows = (itemResult.data || []) as TripSegmentMapRow[];
  const mappedRows = rows.filter(
    (row) => typeof row.lat === "number" && typeof row.lng === "number"
  );
  const unresolvedRows = rows.filter(
    (row) => typeof row.lat !== "number" || typeof row.lng !== "number"
  );
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
  return {
    id: row.id,
    location: row.location,
    locationStatus: row.location_status || null,
    safeRejectedAddress:
      typeof diagnostics?.selectedFormattedAddress === "string"
        ? diagnostics.selectedFormattedAddress
        : null,
    title: row.title || "Trip stop"
  };
}

function isActivityIdea(row: TripSegmentMapRow) {
  const metadata = isRecord(row.provider_metadata) ? row.provider_metadata : {};
  const text = `${row.title || ""} ${row.location || ""} ${row.location_status || ""}`.toLowerCase();
  return (
    row.location_status === "needs_activity_provider" ||
    metadata.activityCandidate === true ||
    /\b(boat tour|tour|cruise|guided|excursion|experience|meeting point|provider)\b/.test(text)
  );
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function mapItem(row: TripSegmentMapRow): TripMapItem {
  const photo = readProviderPhoto(row.provider_metadata);
  return {
    id: row.id,
    imageAlt: photo?.imageAlt || null,
    imageAttribution: photo?.attribution || null,
    imageUrl: buildPlacePhotoUrl(row.provider_metadata, 400),
    lat: Number(row.lat),
    lng: Number(row.lng),
    title: row.title || row.location || "Trip stop"
  };
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
      bookingUrl: inventory?.booking_url || inventory?.source_url || null,
      category: inventory?.category || null,
      id: row.id,
      imageAlt: inventory?.image_alt || photo?.imageAlt || null,
      imageAttribution: inventory?.image_attribution || photo?.attribution || null,
      imageUrl: inventory?.image_url || buildPlacePhotoUrl(metadata, 800),
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
