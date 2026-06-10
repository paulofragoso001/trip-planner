import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import {
  TRIP_TRAVEL_STYLE_LABELS,
  normalizeTravelStyle,
  type TripTravelStyle
} from "@/lib/trips";
import {
  compareHeroSegments,
  fallbackGradientForDestination,
  getFallbackHeroImage,
  imageFromProviderMetadata,
  type WalletHeroImage
} from "@/lib/wallet/hero-image";

export type TripListItemView = {
  dateRange: string;
  destination: string;
  destinationLat: number | null;
  destinationLng: number | null;
  imageAlt: string;
  imageAttribution: string | null;
  imageUrl: string | null;
  href: string;
  id: string;
  mappedStops: number;
  name: string;
  nearbyIdeasCount: number;
  needsLocationStops: number;
  endDate: string | null;
  startDate: string | null;
  status: string;
  stopCount: number;
  travelStyle: TripTravelStyle;
  travelStyleLabel: string;
};

export type TripsData = {
  error: string | null;
  heroImage: WalletHeroImage;
  trips: TripListItemView[];
};

type TripRow = {
  destination: string | null;
  destination_lat?: number | string | null;
  destination_lng?: number | string | null;
  destination_provider_metadata?: Record<string, unknown> | null;
  end_date: string | null;
  id: string;
  name: string;
  start_date: string | null;
  status: string | null;
  travel_style: string | null;
};

type TripSegmentSummary = {
  lat?: number | null;
  latitude?: number | null;
  location_status: string | null;
  lng?: number | null;
  longitude?: number | null;
  trip_id: string;
};

type TripRecommendationSummary = {
  trip_id: string;
};

type TripPassImage = {
  imageAlt: string;
  imageAttribution: string | null;
  imageUrl: string | null;
};

type TripVisualSegment = {
  kind: string | null;
  position: number | null;
  provider_metadata: Record<string, unknown> | null;
  title: string;
  trip_id: string;
};

export async function loadTripsData(): Promise<TripsData> {
  noStore();
  const auth = await authorizeDashboardApi();

  if (!auth) {
    return {
      error: "Sign in to load your trips.",
      heroImage: getFallbackHeroImage("Wayline trips", "Wayline trips background"),
      trips: []
    };
  }

  const { data, error } = await loadTripRows(auth.supabase, auth.userId);

  if (error) {
    console.error(
      JSON.stringify({
        area: "trips",
        event: "trips_load_failed",
        message: error.message,
        userId: auth.userId
      })
    );

    return {
      error: "Could not load trips right now.",
      heroImage: getFallbackHeroImage("Wayline trips", "Wayline trips background"),
      trips: []
    };
  }

  const tripRows = ((data || []) as TripRow[]);
  const summaries = tripRows.length
    ? await loadTripSegmentSummaries(auth.supabase, tripRows.map((trip) => trip.id), auth.userId)
    : new Map<string, SegmentCounts>();
  const recommendationCounts = tripRows.length
    ? await loadTripRecommendationSummaries(auth.supabase, tripRows.map((trip) => trip.id), auth.userId)
    : new Map<string, number>();
  const passImages = tripRows.length
    ? await loadTripPassImages(auth.supabase, tripRows, auth.userId)
    : new Map<string, TripPassImage>();

  return {
    error: null,
    heroImage: buildTripsHeroImage(tripRows[0], passImages.get(tripRows[0]?.id || "")),
    trips: tripRows.map((row) =>
      mapTrip(
        row,
        summaries.get(row.id),
        recommendationCounts.get(row.id) || 0,
        passImages.get(row.id)
      )
    )
  };
}

async function loadTripRows(supabase: any, userId: string) {
  const withDestinationMetadata = await supabase
    .from("trips")
    .select("id,name,destination,destination_lat,destination_lng,start_date,end_date,status,travel_style,destination_provider_metadata")
    .eq("user_id", userId)
    .order("start_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!withDestinationMetadata.error) {
    return withDestinationMetadata;
  }

  if (isMissingDestinationCoordinateColumn(withDestinationMetadata.error.message)) {
    console.warn(
      JSON.stringify({
        area: "trips",
        event: "trips_load_destination_coordinates_fallback",
        message: withDestinationMetadata.error.message,
        userId
      })
    );

    const withoutDestinationCoordinates = await supabase
      .from("trips")
      .select("id,name,destination,start_date,end_date,status,travel_style,destination_provider_metadata")
      .eq("user_id", userId)
      .order("start_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (
      !withoutDestinationCoordinates.error ||
      !isMissingDestinationMetadataColumn(withoutDestinationCoordinates.error.message)
    ) {
      return withoutDestinationCoordinates;
    }
  } else if (!isMissingDestinationMetadataColumn(withDestinationMetadata.error.message)) {
    return withDestinationMetadata;
  }

  console.warn(
    JSON.stringify({
      area: "trips",
      event: "trips_load_destination_metadata_fallback",
      message: withDestinationMetadata.error.message,
      userId
    })
  );

  const withTravelStyle = await supabase
    .from("trips")
    .select("id,name,destination,start_date,end_date,status,travel_style")
    .eq("user_id", userId)
    .order("start_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!withTravelStyle.error || !isMissingTravelStyleColumn(withTravelStyle.error.message)) {
    return withTravelStyle;
  }

  console.warn(
    JSON.stringify({
      area: "trips",
      event: "trips_load_schema_fallback",
      message: withTravelStyle.error.message,
      userId
    })
  );

  return supabase
    .from("trips")
    .select("id,name,destination,start_date,end_date,status")
    .eq("user_id", userId)
    .order("start_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
}

function isMissingTravelStyleColumn(message: string) {
  return /travel_style/i.test(message) && /column|schema cache|could not find/i.test(message);
}

function isMissingDestinationMetadataColumn(message: string) {
  return /destination_provider_metadata/i.test(message) && /column|schema cache|could not find/i.test(message);
}

function isMissingDestinationCoordinateColumn(message: string) {
  return /destination_lat|destination_lng/i.test(message) && /column|schema cache|could not find/i.test(message);
}

type SegmentCounts = {
  mappedStops: number;
  needsLocationStops: number;
  stopCount: number;
};

async function loadTripSegmentSummaries(
  supabase: any,
  tripIds: string[],
  userId: string
): Promise<Map<string, SegmentCounts>> {
  const result = await supabase
    .from("trip_segments")
    .select("trip_id,lat,lng,location_status")
    .in("trip_id", tripIds);

  const { data, error } =
    result.error && isMissingLatLngColumns(result.error.message)
      ? await supabase
          .from("trip_segments")
          .select("trip_id,latitude,longitude,location_status")
          .in("trip_id", tripIds)
      : result;

  if (error) {
    console.warn(
      JSON.stringify({
        area: "trips",
        event: "trip_segment_summary_load_failed",
        message: error.message,
        userId
      })
    );
    return new Map();
  }

  const summaries = new Map<string, SegmentCounts>();
  for (const row of (data || []) as TripSegmentSummary[]) {
    const current = summaries.get(row.trip_id) || {
      mappedStops: 0,
      needsLocationStops: 0,
      stopCount: 0
    };
    const lat = row.lat ?? row.latitude;
    const lng = row.lng ?? row.longitude;
    const mapped = typeof lat === "number" && typeof lng === "number";
    current.stopCount += 1;
    current.mappedStops += mapped ? 1 : 0;
    current.needsLocationStops += !mapped || row.location_status === "needs_location_confirmation" ? 1 : 0;
    summaries.set(row.trip_id, current);
  }

  return summaries;
}

function isMissingLatLngColumns(message: string) {
  return /lat|lng/i.test(message) && /column|schema cache|could not find/i.test(message);
}

async function loadTripRecommendationSummaries(
  supabase: any,
  tripIds: string[],
  userId: string
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("trip_recommendations")
    .select("trip_id")
    .in("trip_id", tripIds);

  if (error) {
    console.warn(
      JSON.stringify({
        area: "trips",
        event: "trip_recommendation_summary_load_failed",
        message: error.message,
        userId
      })
    );
    return new Map();
  }

  const counts = new Map<string, number>();
  for (const row of (data || []) as TripRecommendationSummary[]) {
    counts.set(row.trip_id, (counts.get(row.trip_id) || 0) + 1);
  }
  return counts;
}

async function loadTripPassImages(
  supabase: any,
  trips: TripRow[],
  userId: string
): Promise<Map<string, TripPassImage>> {
  const images = new Map<string, TripPassImage>();
  const visualTrips = trips.slice(0, 12);
  const tripIds = visualTrips.map((trip) => trip.id);

  for (const trip of visualTrips) {
    const image = imageFromProviderMetadata(
      trip.destination_provider_metadata,
      trip.destination ? `Photo of ${trip.destination}` : `Trip image for ${trip.name}`
    );
    if (image) {
      images.set(trip.id, image);
    }
  }

  if (!tripIds.length || tripIds.every((tripId) => images.has(tripId))) {
    return images;
  }

  const segmentResult = await supabase
    .from("trip_segments")
    .select("trip_id,title,kind,position,provider_metadata")
    .in("trip_id", tripIds)
    .eq("user_id", userId)
    .not("provider_metadata", "is", null)
    .order("position", { ascending: true, nullsFirst: false })
    .limit(Math.max(24, tripIds.length * 4));

  if (!segmentResult.error) {
    const segmentsByTrip = new Map<string, TripVisualSegment[]>();
    for (const row of (segmentResult.data || []) as TripVisualSegment[]) {
      if (images.has(row.trip_id)) continue;
      const current = segmentsByTrip.get(row.trip_id) || [];
      current.push(row);
      segmentsByTrip.set(row.trip_id, current);
    }

    for (const [tripId, segments] of segmentsByTrip) {
      for (const segment of [...segments].sort(compareHeroSegments)) {
        const image = imageFromProviderMetadata(
          segment.provider_metadata,
          segment.title ? `Photo of ${segment.title}` : "Trip place photo",
          segment.title || "Trip place"
        );
        if (image) {
          images.set(tripId, image);
          break;
        }
      }
    }
  } else {
    console.warn(
      JSON.stringify({
        area: "trips",
        event: "trip_pass_segment_image_load_failed",
        message: segmentResult.error.message,
        userId
      })
    );
  }

  return images;
}

function buildTripsHeroImage(
  trip: TripRow | undefined,
  passImage: TripPassImage | undefined
): WalletHeroImage {
  if (!trip) return getFallbackHeroImage("Wayline trips", "Wayline trips background");

  const destination = trip.destination || trip.name || "Wayline trip";
  return {
    fallbackGradient: fallbackGradientForDestination(destination),
    imageAlt: passImage?.imageAlt || `${destination} trip pass background`,
    imageAttribution: passImage?.imageAttribution || null,
    imageSourceLabel: trip.destination || trip.name,
    imageUrl: passImage?.imageUrl || null
  };
}

function mapTrip(
  row: TripRow,
  counts?: SegmentCounts,
  nearbyIdeasCount = 0,
  passImage?: TripPassImage
): TripListItemView {
  const travelStyle = normalizeTravelStyle(row.travel_style);

  return {
    dateRange: formatDateRange(row.start_date, row.end_date),
    destination: row.destination || "No destination set",
    destinationLat: normalizeNullableNumber(row.destination_lat),
    destinationLng: normalizeNullableNumber(row.destination_lng),
    imageAlt: passImage?.imageAlt || (row.destination ? `Photo of ${row.destination}` : `Trip image for ${row.name}`),
    imageAttribution: passImage?.imageAttribution || null,
    imageUrl: passImage?.imageUrl || null,
    href: `/dashboard/trips/${row.id}`,
    id: row.id,
    mappedStops: counts?.mappedStops || 0,
    name: row.name,
    nearbyIdeasCount,
    needsLocationStops: counts?.needsLocationStops || 0,
    endDate: row.end_date,
    startDate: row.start_date,
    status: row.status || "Planning",
    stopCount: counts?.stopCount || 0,
    travelStyle,
    travelStyleLabel: TRIP_TRAVEL_STYLE_LABELS[travelStyle]
  };
}

function normalizeNullableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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
