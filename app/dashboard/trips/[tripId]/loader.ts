import "server-only";

import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { isDemoTripId, isUuid } from "@/lib/server/trip-id";

export type TripWorkspaceData = {
  dateRange: string;
  destination: string;
  error: string | null;
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
  end_date: string | null;
  id: string;
  name: string;
  start_date: string | null;
  status: string | null;
  travel_style?: string | null;
};

export async function loadTripWorkspaceData(tripId: string): Promise<TripWorkspaceData> {
  if (isDemoTripId(tripId)) {
    return {
      dateRange: "Jun 11 - Jun 17",
      destination: "Barcelona, Spain",
      error: null,
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

  const { data, error } = await auth.supabase
    .from("trips")
    .select("id,name,destination,start_date,end_date,status,travel_style")
    .eq("id", tripId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) {
    return emptyTripWorkspaceData(tripId, "Could not load this trip right now.");
  }

  if (!data) {
    return emptyTripWorkspaceData(tripId, "Trip not found.");
  }

  const [segmentCounts, suggestionsCount] = await Promise.all([
    loadSegmentCounts(auth.supabase, tripId),
    loadSuggestionsCount(auth.supabase, tripId)
  ]);

  return mapTrip(data as TripRow, segmentCounts, suggestionsCount);
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
  suggestionsCount: number
): TripWorkspaceData {
  return {
    dateRange: formatDateRange(row.start_date, row.end_date),
    destination: row.destination || "No destination set",
    error: null,
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
  return {
    dateRange: "Dates unavailable",
    destination: "Destination unavailable",
    error,
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
