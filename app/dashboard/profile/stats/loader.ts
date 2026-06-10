import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";

export type TravelStatsCountry = {
  country: string;
  count: number;
  flag: string;
};

export type TravelStatsData = {
  error: string | null;
  flags: TravelStatsCountry[];
  stats: {
    cities: number | null;
    countries: number | null;
    ideas: number | null;
    mapped: number;
    places: number;
    trips: number;
  };
};

type TripStatsRow = {
  destination: string | null;
  destination_lat?: number | string | null;
  destination_lng?: number | string | null;
  destination_provider_metadata?: Record<string, unknown> | null;
  id: string;
};

type SegmentStatsRow = {
  id: string;
  lat?: number | string | null;
  latitude?: number | string | null;
  lng?: number | string | null;
  longitude?: number | string | null;
};

type IdeaStatsRow = {
  id: string;
};

const COUNTRY_FLAG_BY_NAME = new Map<string, string>([
  ["argentina", "🇦🇷"],
  ["aruba", "🇦🇼"],
  ["brazil", "🇧🇷"],
  ["canada", "🇨🇦"],
  ["france", "🇫🇷"],
  ["germany", "🇩🇪"],
  ["greece", "🇬🇷"],
  ["italy", "🇮🇹"],
  ["mexico", "🇲🇽"],
  ["portugal", "🇵🇹"],
  ["spain", "🇪🇸"],
  ["switzerland", "🇨🇭"],
  ["united arab emirates", "🇦🇪"],
  ["united kingdom", "🇬🇧"],
  ["united states", "🇺🇸"],
  ["united states of america", "🇺🇸"],
  ["usa", "🇺🇸"]
]);

export async function loadTravelStatsData(): Promise<TravelStatsData> {
  noStore();

  const auth = await authorizeDashboardApi();
  if (!auth) {
    return emptyStats("Sign in to view your travel stats.");
  }

  const tripsResult = await loadTrips(auth.supabase, auth.userId);

  if (tripsResult.error) {
    console.error(
      JSON.stringify({
        area: "profile_stats",
        event: "trips_load_failed",
        message: tripsResult.error.message,
        userId: auth.userId
      })
    );
  }

  const trips = tripsResult.data || [];
  const tripIds = trips.map((trip) => trip.id).filter(Boolean);
  const [segmentsResult, ideasResult] = tripIds.length
    ? await Promise.all([
        loadSegments(auth.supabase, tripIds),
        loadIdeas(auth.supabase, tripIds, auth.userId)
      ])
    : [
        { data: [] as SegmentStatsRow[], error: null as Error | null },
        { data: [] as IdeaStatsRow[], error: null as Error | null }
      ];

  if (segmentsResult.error) {
    console.error(
      JSON.stringify({
        area: "profile_stats",
        event: "segments_load_failed",
        message: segmentsResult.error.message,
        userId: auth.userId
      })
    );
  }

  if (ideasResult.error) {
    console.warn(
      JSON.stringify({
        area: "profile_stats",
        event: "ideas_load_failed",
        message: ideasResult.error.message,
        userId: auth.userId
      })
    );
  }

  const segments = segmentsResult.data || [];
  const countries = deriveCountries(trips);
  const cities = deriveCities(trips);

  return {
    error: tripsResult.error || segmentsResult.error ? "Some travel stats are unavailable right now." : null,
    flags: Array.from(countries.entries())
      .map(([country, count]) => ({
        country,
        count,
        flag: COUNTRY_FLAG_BY_NAME.get(country.toLowerCase()) || ""
      }))
      .filter((country) => country.flag)
      .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country))
      .slice(0, 8),
    stats: {
      cities: cities.size ? cities.size : null,
      countries: countries.size ? countries.size : null,
      ideas: ideasResult.error ? null : (ideasResult.data || []).length,
      mapped: segments.filter(hasCoordinates).length,
      places: segments.length,
      trips: trips.length
    }
  };
}

async function loadTrips(supabase: any, userId: string) {
  const withMetadata = await supabase
    .from("trips")
    .select("id,destination,destination_lat,destination_lng,destination_provider_metadata")
    .eq("user_id", userId);

  if (!withMetadata.error) {
    return {
      data: (withMetadata.data || []) as TripStatsRow[],
      error: null as Error | null
    };
  }

  if (!isMissingDestinationMetadata(withMetadata.error.message)) {
    return {
      data: [] as TripStatsRow[],
      error: withMetadata.error as Error
    };
  }

  const fallback = await supabase
    .from("trips")
    .select("id,destination,destination_lat,destination_lng")
    .eq("user_id", userId);

  return {
    data: (fallback.data || []) as TripStatsRow[],
    error: fallback.error as Error | null
  };
}

async function loadSegments(supabase: any, tripIds: string[]) {
  const withLatLng = await supabase
    .from("trip_segments")
    .select("id,lat,lng")
    .in("trip_id", tripIds);

  if (!withLatLng.error) {
    return {
      data: (withLatLng.data || []) as SegmentStatsRow[],
      error: null as Error | null
    };
  }

  if (!/lat|lng|column|schema cache|could not find/i.test(withLatLng.error.message)) {
    return {
      data: [] as SegmentStatsRow[],
      error: withLatLng.error as Error
    };
  }

  const withLatitudeLongitude = await supabase
    .from("trip_segments")
    .select("id,latitude,longitude")
    .in("trip_id", tripIds);

  return {
    data: (withLatitudeLongitude.data || []) as SegmentStatsRow[],
    error: withLatitudeLongitude.error as Error | null
  };
}

async function loadIdeas(supabase: any, tripIds: string[], userId: string) {
  const ideasByTrip = await supabase
    .from("extracted_places")
    .select("id")
    .in("trip_id", tripIds);

  if (!ideasByTrip.error) {
    return {
      data: (ideasByTrip.data || []) as IdeaStatsRow[],
      error: null as Error | null
    };
  }

  if (!/trip_id|column|schema cache|could not find/i.test(ideasByTrip.error.message)) {
    return {
      data: [] as IdeaStatsRow[],
      error: ideasByTrip.error as Error
    };
  }

  const ideasByUser = await supabase
    .from("extracted_places")
    .select("id")
    .eq("user_id", userId);

  return {
    data: (ideasByUser.data || []) as IdeaStatsRow[],
    error: ideasByUser.error as Error | null
  };
}

function deriveCountries(trips: TripStatsRow[]) {
  const countries = new Map<string, number>();

  for (const trip of trips) {
    const country = countryFromMetadata(trip.destination_provider_metadata);
    if (!country) {
      continue;
    }

    countries.set(country, (countries.get(country) || 0) + 1);
  }

  return countries;
}

function deriveCities(trips: TripStatsRow[]) {
  const cities = new Set<string>();

  for (const trip of trips) {
    if (!hasCoordinates(trip)) {
      continue;
    }

    const city = cityFromMetadata(trip.destination_provider_metadata) || cityFromDestination(trip.destination);
    if (city) {
      cities.add(city.toLowerCase());
    }
  }

  return cities;
}

function cityFromDestination(destination: string | null) {
  const [city] = (destination || "").split(",").map((part) => part.trim()).filter(Boolean);
  if (!city || /manual destination|destination/i.test(city)) {
    return null;
  }

  return city;
}

function countryFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  const component = getAddressComponent(metadata, "country");
  if (component) {
    return component;
  }

  const formattedAddress = getStringValue(metadata, [
    "formatted_address",
    "formattedAddress",
    "address"
  ]);
  const country = formattedAddress?.split(",").map((part) => part.trim()).filter(Boolean).at(-1);
  return normalizeCountry(country);
}

function cityFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  return (
    getAddressComponent(metadata, "locality") ||
    getAddressComponent(metadata, "postal_town") ||
    getAddressComponent(metadata, "administrative_area_level_2")
  );
}

function getAddressComponent(
  metadata: Record<string, unknown> | null | undefined,
  type: string
) {
  const components = metadata?.address_components || metadata?.addressComponents;
  if (!Array.isArray(components)) {
    return null;
  }

  for (const component of components) {
    if (!isRecord(component) || !Array.isArray(component.types)) {
      continue;
    }

    if (!component.types.includes(type)) {
      continue;
    }

    const value = typeof component.long_name === "string"
      ? component.long_name
      : typeof component.longName === "string"
        ? component.longName
        : null;
    if (value) {
      return normalizeCountry(value) || value;
    }
  }

  return null;
}

function getStringValue(
  metadata: Record<string, unknown> | null | undefined,
  keys: string[]
) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function normalizeCountry(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (/^us$/i.test(normalized) || /^usa$/i.test(normalized)) {
    return "United States";
  }

  return normalized;
}

function hasCoordinates(row: {
  destination_lat?: number | string | null;
  destination_lng?: number | string | null;
  lat?: number | string | null;
  latitude?: number | string | null;
  lng?: number | string | null;
  longitude?: number | string | null;
}) {
  const lat = toNumber(row.lat ?? row.latitude ?? row.destination_lat);
  const lng = toNumber(row.lng ?? row.longitude ?? row.destination_lng);
  return lat !== null && lng !== null;
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isMissingDestinationMetadata(message: string) {
  return /destination_lat|destination_lng|destination_provider_metadata|column|schema cache|could not find/i.test(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function emptyStats(error: string): TravelStatsData {
  return {
    error,
    flags: [],
    stats: {
      cities: null,
      countries: null,
      ideas: null,
      mapped: 0,
      places: 0,
      trips: 0
    }
  };
}
