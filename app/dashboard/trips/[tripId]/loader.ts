import "server-only";

import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { listTripRecommendations } from "@/lib/server/travel-recommendations";
import { isDemoTripId, isUuid } from "@/lib/server/trip-id";
import { buildPlacePhotoUrl, readProviderPhoto } from "@/lib/travel-data/photo-url";

export type TripHeroImage = {
  fallbackGradient: string;
  imageAlt: string;
  imageAttribution: string | null;
  imageSourceLabel: string | null;
  imageUrl: string | null;
};

export type TripWorkspaceData = {
  dateRange: string;
  destination: string;
  error: string | null;
  heroImage: TripHeroImage;
  id: string;
  mappedStops: number;
  name: string;
  needsLocationStops: number;
  suggestionsCount: number;
  status: string;
  stopCount: number;
  travelStyle: string;
};

type TripRow = {
  destination: string | null;
  destination_provider_metadata?: Record<string, unknown> | null;
  end_date: string | null;
  id: string;
  name: string;
  start_date: string | null;
  status: string | null;
  travel_style?: string | null;
};

type HeroSegmentRow = {
  id: string;
  inserted_at?: string | null;
  kind?: string | null;
  lat?: number | null;
  lng?: number | null;
  position?: number | null;
  provider_metadata?: Record<string, unknown> | null;
  start_time?: string | null;
  title: string;
};

type HeroRecommendationRow = {
  travel_inventory?: Record<string, unknown> | Record<string, unknown>[] | null;
};

export async function loadTripWorkspaceData(tripId: string): Promise<TripWorkspaceData> {
  if (isDemoTripId(tripId)) {
    return {
      dateRange: "Jun 11 - Jun 17",
      destination: "Barcelona, Spain",
      error: null,
      heroImage: getTripHeroImage(
        {
          destination: "Barcelona, Spain",
          name: "Barcelona Work Trip"
        },
        [],
        []
      ),
      id: tripId,
      mappedStops: 3,
      name: "Barcelona Work Trip",
      needsLocationStops: 1,
      status: "Demo",
      stopCount: 4,
      suggestionsCount: 2,
      travelStyle: "Balanced"
    };
  }

  if (!isUuid(tripId)) {
    return emptyTripWorkspaceData(tripId, "Invalid trip id.");
  }

  const auth = await authorizeDashboardApi();

  if (!auth) {
    return emptyTripWorkspaceData(tripId, "Sign in to load this trip.");
  }

  const initialTripResult = await auth.supabase
    .from("trips")
    .select("id,name,destination,start_date,end_date,status,travel_style,destination_provider_metadata")
    .eq("id", tripId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  const { data, error } =
    initialTripResult.error && isMissingDestinationMetadataColumn(initialTripResult.error.message)
      ? await auth.supabase
          .from("trips")
          .select("id,name,destination,start_date,end_date,status,travel_style")
          .eq("id", tripId)
          .eq("user_id", auth.userId)
          .maybeSingle()
      : initialTripResult;

  if (error) {
    return emptyTripWorkspaceData(tripId, "Could not load this trip right now.");
  }

  if (!data) {
    return emptyTripWorkspaceData(tripId, "Trip not found.");
  }

  const [segmentCounts, suggestionsCount, heroSegments, heroRecommendations] = await Promise.all([
    loadSegmentCounts(auth.supabase, tripId),
    loadSuggestionsCount(auth.supabase, tripId),
    loadHeroSegments(auth.supabase, tripId),
    listTripRecommendations(auth.supabase, auth.userId, tripId).catch(() => [])
  ]);

  const row = data as TripRow;
  return mapTrip(
    row,
    segmentCounts,
    suggestionsCount,
    getTripHeroImage(row, heroSegments, heroRecommendations)
  );
}

type SegmentCounts = {
  mappedStops: number;
  needsLocationStops: number;
  stopCount: number;
};

async function loadSegmentCounts(supabase: any, tripId: string): Promise<SegmentCounts> {
  const result = await supabase
    .from("trip_segments")
    .select("lat,lng,location_status")
    .eq("trip_id", tripId);

  const { data, error } =
    result.error && isMissingLatLngColumns(result.error.message)
      ? await supabase
          .from("trip_segments")
          .select("latitude,longitude,location_status")
          .eq("trip_id", tripId)
      : result;

  if (error) {
    return { mappedStops: 0, needsLocationStops: 0, stopCount: 0 };
  }

  return (data || []).reduce(
    (counts: SegmentCounts, row: any) => {
      const lat = row.lat ?? row.latitude;
      const lng = row.lng ?? row.longitude;
      const mapped = typeof lat === "number" && typeof lng === "number";
      counts.stopCount += 1;
      counts.mappedStops += mapped ? 1 : 0;
      counts.needsLocationStops += !mapped || row.location_status === "needs_location_confirmation" ? 1 : 0;
      return counts;
    },
    { mappedStops: 0, needsLocationStops: 0, stopCount: 0 }
  );
}

function isMissingLatLngColumns(message: string) {
  return /lat|lng/i.test(message) && /column|schema cache|could not find/i.test(message);
}

function isMissingDestinationMetadataColumn(message: string) {
  return /destination_provider_metadata/i.test(message) && /column|schema cache|could not find/i.test(message);
}

async function loadHeroSegments(supabase: any, tripId: string): Promise<HeroSegmentRow[]> {
  const result = await supabase
    .from("trip_segments")
    .select("id,title,kind,lat,lng,position,start_time,inserted_at,provider_metadata")
    .eq("trip_id", tripId)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .order("position", { ascending: true, nullsFirst: false })
    .limit(12);

  const { data, error } =
    result.error && isMissingLatLngColumns(result.error.message)
      ? await supabase
          .from("trip_segments")
          .select("id,title,kind,latitude,longitude,position,start_time,inserted_at,provider_metadata")
          .eq("trip_id", tripId)
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .order("position", { ascending: true, nullsFirst: false })
          .limit(12)
      : result;

  if (error) return [];

  return ((data || []) as any[]).map((segment) => ({
    id: String(segment.id),
    inserted_at: segment.inserted_at ?? null,
    kind: segment.kind ?? null,
    lat: segment.lat ?? segment.latitude ?? null,
    lng: segment.lng ?? segment.longitude ?? null,
    position: typeof segment.position === "number" ? segment.position : null,
    provider_metadata: isRecord(segment.provider_metadata) ? segment.provider_metadata : null,
    start_time: segment.start_time ?? null,
    title: String(segment.title || "Trip place")
  }));
}

async function loadSuggestionsCount(supabase: any, tripId: string): Promise<number> {
  const { count, error } = await supabase
    .from("trip_recommendations")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId)
    .eq("status", "suggested");

  if (error) return 0;
  return count || 0;
}

function mapTrip(
  row: TripRow,
  segmentCounts: SegmentCounts,
  suggestionsCount: number,
  heroImage: TripHeroImage
): TripWorkspaceData {
  return {
    dateRange: formatDateRange(row.start_date, row.end_date),
    destination: row.destination || "No destination set",
    error: null,
    heroImage,
    id: row.id,
    mappedStops: segmentCounts.mappedStops,
    name: row.name,
    needsLocationStops: segmentCounts.needsLocationStops,
    suggestionsCount,
    status: row.status || "Planning",
    stopCount: segmentCounts.stopCount,
    travelStyle: formatTravelStyle(row.travel_style)
  };
}

function emptyTripWorkspaceData(tripId: string, error: string): TripWorkspaceData {
  const heroImage = getTripHeroImage(
    {
      destination: "Destination unavailable",
      name: "Trip unavailable"
    },
    [],
    []
  );

  return {
    dateRange: "Dates unavailable",
    destination: "Destination unavailable",
    error,
    heroImage,
    id: tripId,
    mappedStops: 0,
    name: "Trip unavailable",
    needsLocationStops: 0,
    status: "Unavailable",
    stopCount: 0,
    suggestionsCount: 0,
    travelStyle: "Not set"
  };
}

function getTripHeroImage(
  trip: Pick<TripRow, "destination" | "destination_provider_metadata" | "name">,
  segments: HeroSegmentRow[],
  recommendations: HeroRecommendationRow[]
): TripHeroImage {
  const destination = trip.destination || trip.name || "Wayline trip";
  const fallbackGradient = fallbackGradientForDestination(destination);
  const destinationPhoto = imageFromProviderMetadata(
    trip.destination_provider_metadata,
    `${destination} trip photo`,
    "Destination"
  );

  if (destinationPhoto) {
    return { ...destinationPhoto, fallbackGradient };
  }

  const visualSegment = segments
    .filter((segment) => readProviderPhoto(segment.provider_metadata))
    .sort(compareHeroSegments)[0];

  if (visualSegment) {
    const segmentPhoto = imageFromProviderMetadata(
      visualSegment.provider_metadata,
      `Photo of ${visualSegment.title}`,
      visualSegment.title
    );
    if (segmentPhoto) {
      return { ...segmentPhoto, fallbackGradient };
    }
  }

  const recommendationPhoto = recommendations
    .map((recommendation) => {
      const inventory = readRecommendationInventory(recommendation);
      return inventory ? imageFromInventory(inventory) : null;
    })
    .find(Boolean);

  if (recommendationPhoto) {
    return { ...recommendationPhoto, fallbackGradient };
  }

  return {
    fallbackGradient,
    imageAlt: `${destination} trip background`,
    imageAttribution: null,
    imageSourceLabel: null,
    imageUrl: null
  };
}

function imageFromProviderMetadata(
  metadata: Record<string, unknown> | null | undefined,
  fallbackAlt: string,
  sourceLabel: string
): Omit<TripHeroImage, "fallbackGradient"> | null {
  const photo = readProviderPhoto(metadata);
  const imageUrl = buildPlacePhotoUrl(metadata, 1200);
  if (!photo || !imageUrl) return null;

  return {
    imageAlt: photo.imageAlt || fallbackAlt,
    imageAttribution: photo.attribution || null,
    imageSourceLabel: sourceLabel,
    imageUrl
  };
}

function imageFromInventory(
  inventory: Record<string, unknown>
): Omit<TripHeroImage, "fallbackGradient"> | null {
  const title = readString(inventory.title) || "Nearby idea";
  const imageUrl =
    readString(inventory.image_url) ||
    buildPlacePhotoUrl(isRecord(inventory.metadata) ? inventory.metadata : null, 1200);

  if (!imageUrl) return null;

  const metadataPhoto = readProviderPhoto(isRecord(inventory.metadata) ? inventory.metadata : null);
  return {
    imageAlt: readString(inventory.image_alt) || metadataPhoto?.imageAlt || `Photo of ${title}`,
    imageAttribution: readString(inventory.image_attribution) || metadataPhoto?.attribution || null,
    imageSourceLabel: title,
    imageUrl
  };
}

function readRecommendationInventory(recommendation: HeroRecommendationRow) {
  const inventory = recommendation.travel_inventory;
  if (Array.isArray(inventory)) return inventory.find(isRecord) || null;
  return isRecord(inventory) ? inventory : null;
}

function compareHeroSegments(a: HeroSegmentRow, b: HeroSegmentRow) {
  const priority = segmentVisualPriority(a) - segmentVisualPriority(b);
  if (priority !== 0) return priority;

  const positionA = typeof a.position === "number" ? a.position : Number.MAX_SAFE_INTEGER;
  const positionB = typeof b.position === "number" ? b.position : Number.MAX_SAFE_INTEGER;
  if (positionA !== positionB) return positionA - positionB;

  const timeA = a.start_time || "";
  const timeB = b.start_time || "";
  if (timeA !== timeB) return timeA.localeCompare(timeB);

  return (a.inserted_at || "").localeCompare(b.inserted_at || "");
}

function segmentVisualPriority(segment: HeroSegmentRow) {
  const value = `${segment.kind || ""} ${segment.title || ""}`.toLowerCase();
  if (/landmark|attraction|museum|wall|park|garden|beach|neighborhood|district|centre|center|sagrada|wynwood/.test(value)) {
    return 1;
  }
  if (/restaurant|food|dinner|lunch|cafe|coffee|bar/.test(value)) {
    return 2;
  }
  if (/hotel|lodging|stay/.test(value)) {
    return 3;
  }
  if (/flight|airport|transport|station|terminal/.test(value)) {
    return 4;
  }
  return 5;
}

function fallbackGradientForDestination(destination: string) {
  const value = destination.toLowerCase();
  if (value.includes("miami")) {
    return "bg-[linear-gradient(135deg,#0f766e,#2563eb_46%,#f97316)]";
  }
  if (value.includes("barcelona")) {
    return "bg-[linear-gradient(135deg,#7c2d12,#1d4ed8_52%,#f59e0b)]";
  }
  if (value.includes("new york")) {
    return "bg-[linear-gradient(135deg,#111827,#334155_45%,#7f1d1d)]";
  }
  return "bg-[linear-gradient(135deg,#172554,#0f766e_55%,#111827)]";
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function formatTravelStyle(value: string | null | undefined) {
  if (!value) return "Balanced";
  return value
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) {
    return "Dates not set";
  }

  if (startDate && !endDate) {
    return formatDate(startDate);
  }

  if (!startDate && endDate) {
    return formatDate(endDate);
  }

  return `${formatDate(startDate!)} - ${formatDate(endDate!)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00.000Z`));
}
