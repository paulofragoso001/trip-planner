import "server-only";

import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import {
  TRIP_TRAVEL_STYLE_LABELS,
  normalizeTravelStyle,
  type TripTravelStyle
} from "@/lib/trips";

export type TripListItemView = {
  dateRange: string;
  destination: string;
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
  trips: TripListItemView[];
};

type TripRow = {
  destination: string | null;
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

export async function loadTripsData(): Promise<TripsData> {
  const auth = await authorizeDashboardApi();

  if (!auth) {
    return {
      error: "Sign in to load your trips.",
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

  return {
    error: null,
    trips: tripRows.map((row) => mapTrip(row, summaries.get(row.id), recommendationCounts.get(row.id) || 0))
  };
}

async function loadTripRows(supabase: any, userId: string) {
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

function mapTrip(row: TripRow, counts?: SegmentCounts, nearbyIdeasCount = 0): TripListItemView {
  const travelStyle = normalizeTravelStyle(row.travel_style);

  return {
    dateRange: formatDateRange(row.start_date, row.end_date),
    destination: row.destination || "No destination set",
    imageAlt: row.destination ? `Photo of ${row.destination}` : `Trip image for ${row.name}`,
    imageAttribution: null,
    imageUrl: null,
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
