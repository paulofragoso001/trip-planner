import "server-only";

import type { TripMapItem } from "@/components/TripMap";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { isDemoTripId, isUuid } from "@/lib/server/trip-id";

export type TripMapData = {
  destination: string | null;
  error: string | null;
  items: TripMapItem[];
  searchUrl: string | null;
  tripId: string;
};

type TripRow = {
  destination: string | null;
};

type TripSegmentMapRow = {
  id: string;
  lat: number | null;
  lng: number | null;
  location: string | null;
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
      searchUrl: googleMapsSearchUrl("Barcelona, Spain"),
      tripId
    };
  }

  if (!isUuid(tripId)) {
    return emptyMapData(tripId, "Invalid trip id.");
  }

  const auth = await authorizeDashboardApi();

  if (!auth) {
    return emptyMapData(tripId, "Sign in to load trip map data.");
  }

  const [tripResult, itemResult] = await Promise.all([
    auth.supabase
      .from("trips")
      .select("destination")
      .eq("id", tripId)
      .eq("user_id", auth.userId)
      .maybeSingle(),
    auth.supabase
      .from("trip_segments")
      .select("id,title,location,lat,lng")
      .eq("trip_id", tripId)
      .eq("user_id", auth.userId)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .order("position", { ascending: true, nullsFirst: false })
      .order("start_time", { ascending: true, nullsFirst: false })
  ]);

  if (tripResult.error || itemResult.error) {
    return emptyMapData(tripId, "Could not load trip map data.");
  }

  if (!tripResult.data) {
    return emptyMapData(tripId, "Trip not found.");
  }

  const trip = tripResult.data as TripRow;

  return {
    destination: trip.destination,
    error: null,
    items: ((itemResult.data || []) as TripSegmentMapRow[]).map(mapItem),
    searchUrl: trip.destination ? googleMapsSearchUrl(trip.destination) : null,
    tripId
  };
}

function emptyMapData(tripId: string, error: string): TripMapData {
  return {
    destination: null,
    error,
    items: [],
    searchUrl: null,
    tripId
  };
}

function mapItem(row: TripSegmentMapRow): TripMapItem {
  return {
    id: row.id,
    lat: Number(row.lat),
    lng: Number(row.lng),
    title: row.title || row.location || "Trip stop"
  };
}

function googleMapsSearchUrl(value: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
}
