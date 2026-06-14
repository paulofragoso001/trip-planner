import "server-only";

import { unstable_noStore as noStore } from "next/cache";

import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { readTripSegmentRoute, type TripRouteEndpoint } from "@/lib/trip-segment-route";

export type TravelStatsCountry = {
  country: string;
  count: number;
  flag: string;
};

export type TravelStatsTransportCard = {
  breakdown: TravelStatsCountry[];
  count: number;
  detailLabel: string;
  detailValue: string | null;
  id: "air" | "train" | "road";
  timeLabel: string | null;
  title: string;
};

export type TravelStatsData = {
  countries: TravelStatsCountry[];
  daysTraveling: number;
  error: string | null;
  flags: TravelStatsCountry[];
  selectedYear: number | null;
  stats: {
    activities: number;
    cities: number | null;
    countries: number | null;
    daysTraveling: number;
    flights: number;
    hotels: number;
    mapped: number;
    places: number;
    trips: number;
  };
  transport: TravelStatsTransportCard[];
  yearOptions: number[];
};

type TripStatsRow = {
  destination: string | null;
  destination_lat?: number | string | null;
  destination_lng?: number | string | null;
  destination_provider_metadata?: Record<string, unknown> | null;
  end_date?: string | null;
  id: string;
  name?: string | null;
  start_date?: string | null;
};

type SegmentStatsRow = {
  end_time?: string | null;
  id: string;
  kind?: string | null;
  lat?: number | string | null;
  latitude?: number | string | null;
  lng?: number | string | null;
  location?: string | null;
  longitude?: number | string | null;
  provider_metadata?: Record<string, unknown> | null;
  start_time?: string | null;
  title?: string | null;
  trip_id?: string | null;
};

type IdeaStatsRow = {
  id: string;
};

type TransportAccumulator = {
  countries: Map<string, number>;
  count: number;
  distanceMiles: number;
  endpointLabels: Set<string>;
  durationMs: number;
  hasDistance: boolean;
};

const WORLD_COUNTRY_TOTAL = 246;
const CURRENT_YEAR = new Date().getFullYear();

const COUNTRY_FLAG_BY_NAME = new Map<string, string>([
  ["argentina", "🇦🇷"],
  ["aruba", "🇦🇼"],
  ["brazil", "🇧🇷"],
  ["canada", "🇨🇦"],
  ["chile", "🇨🇱"],
  ["colombia", "🇨🇴"],
  ["france", "🇫🇷"],
  ["germany", "🇩🇪"],
  ["greece", "🇬🇷"],
  ["iceland", "🇮🇸"],
  ["italy", "🇮🇹"],
  ["mexico", "🇲🇽"],
  ["netherlands", "🇳🇱"],
  ["panama", "🇵🇦"],
  ["portugal", "🇵🇹"],
  ["spain", "🇪🇸"],
  ["switzerland", "🇨🇭"],
  ["united arab emirates", "🇦🇪"],
  ["united kingdom", "🇬🇧"],
  ["united states", "🇺🇸"],
  ["united states of america", "🇺🇸"],
  ["usa", "🇺🇸"]
]);

export async function loadTravelStatsData(
  requestedYear: number | null = CURRENT_YEAR
): Promise<TravelStatsData> {
  noStore();

  const auth = await authorizeDashboardApi();
  if (!auth) {
    return emptyStats("Sign in to view your travel stats.", requestedYear);
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

  const allTrips = tripsResult.data || [];
  const tripIds = allTrips.map((trip) => trip.id).filter(Boolean);
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

  const allSegments = segmentsResult.data || [];
  const yearOptions = deriveYearOptions(allTrips, allSegments);
  const selectedYear = normalizeRequestedYear(requestedYear, yearOptions);
  const trips = allTrips.filter((trip) => isTripInYear(trip, selectedYear));
  const selectedTripIds = new Set(trips.map((trip) => trip.id));
  const segments = allSegments.filter((segment) => isSegmentInYear(segment, selectedYear, selectedTripIds));
  const countries = deriveCountries(trips, segments);
  const cities = deriveCities(trips, segments);
  const transport = deriveTransportStats(segments);
  const flights = countKinds(segments, ["flight"]);
  const hotels = countKinds(segments, ["hotel", "lodging", "stay"]);
  const activities = segments.filter((segment) => {
    const kind = normalizeKind(segment.kind);
    return !["flight", "hotel", "lodging", "stay", "note"].includes(kind);
  }).length;
  const daysTraveling = deriveTravelDays(trips, selectedYear);

  return {
    countries: countriesToList(countries),
    daysTraveling,
    error: tripsResult.error || segmentsResult.error ? "Some travel stats are unavailable right now." : null,
    flags: countriesToList(countries).slice(0, 8),
    selectedYear,
    stats: {
      activities,
      cities: cities.size ? cities.size : null,
      countries: countries.size ? countries.size : null,
      daysTraveling,
      flights,
      hotels,
      mapped: segments.filter(hasCoordinates).length,
      places: segments.length,
      trips: trips.length
    },
    transport,
    yearOptions
  };
}

async function loadTrips(supabase: any, userId: string) {
  const withMetadata = await supabase
    .from("trips")
    .select("id,name,destination,start_date,end_date,destination_lat,destination_lng,destination_provider_metadata")
    .eq("user_id", userId);

  if (!withMetadata.error) {
    return {
      data: (withMetadata.data || []) as TripStatsRow[],
      error: null as Error | null
    };
  }

  if (!isMissingTripStatsColumn(withMetadata.error.message)) {
    return {
      data: [] as TripStatsRow[],
      error: withMetadata.error as Error
    };
  }

  const fallback = await supabase
    .from("trips")
    .select("id,name,destination,start_date,end_date")
    .eq("user_id", userId);

  return {
    data: (fallback.data || []) as TripStatsRow[],
    error: fallback.error as Error | null
  };
}

async function loadSegments(supabase: any, tripIds: string[]) {
  const withMetadata = await supabase
    .from("trip_segments")
    .select("id,trip_id,kind,title,location,start_time,end_time,lat,lng,provider_metadata")
    .in("trip_id", tripIds);

  if (!withMetadata.error) {
    return {
      data: (withMetadata.data || []) as SegmentStatsRow[],
      error: null as Error | null
    };
  }

  if (!/lat|lng|provider_metadata|column|schema cache|could not find/i.test(withMetadata.error.message)) {
    return {
      data: [] as SegmentStatsRow[],
      error: withMetadata.error as Error
    };
  }

  const fallback = await supabase
    .from("trip_segments")
    .select("id,trip_id,kind,title,location,start_time,end_time")
    .in("trip_id", tripIds);

  return {
    data: (fallback.data || []) as SegmentStatsRow[],
    error: fallback.error as Error | null
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

function deriveYearOptions(trips: TripStatsRow[], segments: SegmentStatsRow[]) {
  const years = new Set<number>();

  for (const trip of trips) {
    addYear(years, trip.start_date);
    addYear(years, trip.end_date);
  }

  for (const segment of segments) {
    addYear(years, segment.start_time);
    addYear(years, segment.end_time);
  }

  years.add(CURRENT_YEAR);
  return Array.from(years).sort((a, b) => b - a);
}

function normalizeRequestedYear(requestedYear: number | null, yearOptions: number[]) {
  if (requestedYear === null) {
    return null;
  }

  if (Number.isInteger(requestedYear) && requestedYear >= 1900 && requestedYear <= 2200) {
    return requestedYear;
  }

  return yearOptions[0] ?? CURRENT_YEAR;
}

function deriveCountries(trips: TripStatsRow[], segments: SegmentStatsRow[]) {
  const countries = new Map<string, number>();

  for (const trip of trips) {
    const country =
      countryFromMetadata(trip.destination_provider_metadata) ||
      countryFromText(trip.destination);
    if (country) incrementMap(countries, country);
  }

  for (const segment of segments) {
    const route = readTripSegmentRoute(segment.provider_metadata);
    const endpointCountries = [
      countryFromEndpoint(route?.origin),
      countryFromEndpoint(route?.destination)
    ].filter(Boolean) as string[];
    const country =
      endpointCountries[0] ||
      countryFromMetadata(segment.provider_metadata) ||
      countryFromText(segment.location);
    if (country) incrementMap(countries, country);
  }

  return countries;
}

function deriveCities(trips: TripStatsRow[], segments: SegmentStatsRow[]) {
  const cities = new Set<string>();

  for (const trip of trips) {
    const city = cityFromMetadata(trip.destination_provider_metadata) || cityFromDestination(trip.destination);
    if (city) cities.add(city.toLowerCase());
  }

  for (const segment of segments) {
    const route = readTripSegmentRoute(segment.provider_metadata);
    const city =
      cityFromEndpoint(route?.origin) ||
      cityFromEndpoint(route?.destination) ||
      cityFromMetadata(segment.provider_metadata) ||
      cityFromDestination(segment.location);
    if (city) cities.add(city.toLowerCase());
  }

  return cities;
}

function deriveTransportStats(segments: SegmentStatsRow[]): TravelStatsTransportCard[] {
  const accumulators: Record<TravelStatsTransportCard["id"], TransportAccumulator> = {
    air: emptyTransportAccumulator(),
    road: emptyTransportAccumulator(),
    train: emptyTransportAccumulator()
  };

  for (const segment of segments) {
    const mode = inferTransportMode(segment);
    if (!mode) continue;

    const accumulator = accumulators[mode];
    const route = readTripSegmentRoute(segment.provider_metadata);
    accumulator.count += 1;
    accumulator.durationMs += durationBetween(
      route?.departAt || segment.start_time,
      route?.arriveAt || segment.end_time
    );

    const distance = routeDistanceMiles(route);
    if (distance !== null) {
      accumulator.distanceMiles += distance;
      accumulator.hasDistance = true;
    }

    for (const endpoint of [route?.origin, route?.destination]) {
      if (endpoint?.code) accumulator.endpointLabels.add(endpoint.code);
      else if (endpoint?.label) accumulator.endpointLabels.add(endpoint.label);
      const country = countryFromEndpoint(endpoint);
      if (country) incrementMap(accumulator.countries, country);
    }

    const fallbackCountry =
      countryFromMetadata(segment.provider_metadata) ||
      countryFromText(segment.location);
    if (fallbackCountry && accumulator.countries.size === 0) {
      incrementMap(accumulator.countries, fallbackCountry);
    }
  }

  return [
    buildTransportCard("air", "In the air", "Airports", accumulators.air),
    buildTransportCard("train", "On the train", "Stations", accumulators.train),
    buildTransportCard("road", "On the road", "Distance", accumulators.road)
  ];
}

function buildTransportCard(
  id: TravelStatsTransportCard["id"],
  title: string,
  detailLabel: string,
  accumulator: TransportAccumulator
): TravelStatsTransportCard {
  const distanceLabel = accumulator.hasDistance ? `${Math.round(accumulator.distanceMiles).toLocaleString()} mi` : null;
  const endpointCount = accumulator.endpointLabels.size ? String(accumulator.endpointLabels.size) : null;

  return {
    breakdown: countriesToList(accumulator.countries).slice(0, 4),
    count: accumulator.count,
    detailLabel,
    detailValue: id === "road" ? distanceLabel : endpointCount,
    id,
    timeLabel: formatDuration(accumulator.durationMs),
    title
  };
}

function inferTransportMode(segment: SegmentStatsRow): TravelStatsTransportCard["id"] | null {
  const route = readTripSegmentRoute(segment.provider_metadata);
  const value = `${route?.mode || ""} ${segment.kind || ""} ${segment.title || ""}`.toLowerCase();

  if (/flight|air|airport|plane/.test(value)) return "air";
  if (/train|rail|station/.test(value)) return "train";
  if (/drive|road|car|bus|transfer|transportation|ferry/.test(value)) return "road";
  return null;
}

function deriveTravelDays(trips: TripStatsRow[], selectedYear: number | null) {
  const days = new Set<string>();

  for (const trip of trips) {
    const start = dateOnly(trip.start_date);
    const end = dateOnly(trip.end_date) || start;
    if (!start || !end) continue;

    const clampedStart = selectedYear === null ? start : maxDate(start, new Date(Date.UTC(selectedYear, 0, 1)));
    const clampedEnd = selectedYear === null ? end : minDate(end, new Date(Date.UTC(selectedYear, 11, 31)));

    if (clampedStart.getTime() > clampedEnd.getTime()) continue;

    for (
      const date = new Date(clampedStart.getTime());
      date.getTime() <= clampedEnd.getTime();
      date.setUTCDate(date.getUTCDate() + 1)
    ) {
      days.add(date.toISOString().slice(0, 10));
    }
  }

  return days.size;
}

function isTripInYear(trip: TripStatsRow, selectedYear: number | null) {
  if (selectedYear === null) return true;
  const start = dateOnly(trip.start_date);
  const end = dateOnly(trip.end_date) || start;
  if (!start && !end) return false;

  const yearStart = new Date(Date.UTC(selectedYear, 0, 1));
  const yearEnd = new Date(Date.UTC(selectedYear, 11, 31));
  return Boolean((start || end)! <= yearEnd && (end || start)! >= yearStart);
}

function isSegmentInYear(
  segment: SegmentStatsRow,
  selectedYear: number | null,
  selectedTripIds: Set<string>
) {
  if (segment.trip_id && !selectedTripIds.has(segment.trip_id)) return false;
  if (selectedYear === null) return true;
  const date = dateOnly(segment.start_time || segment.end_time);
  return date ? date.getUTCFullYear() === selectedYear : selectedTripIds.has(String(segment.trip_id || ""));
}

function countriesToList(countries: Map<string, number>) {
  return Array.from(countries.entries())
    .map(([country, count]) => ({
      country,
      count,
      flag: flagForCountry(country)
    }))
    .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
}

function countKinds(segments: SegmentStatsRow[], kinds: string[]) {
  return segments.filter((segment) => {
    const kind = normalizeKind(segment.kind);
    return kinds.some((candidate) => kind.includes(candidate));
  }).length;
}

function cityFromDestination(destination: string | null | undefined) {
  const [city] = (destination || "").split(",").map((part) => part.trim()).filter(Boolean);
  if (!city || /manual destination|destination/i.test(city)) {
    return null;
  }

  return city;
}

function countryFromText(value: string | null | undefined) {
  const parts = (value || "").split(",").map((part) => part.trim()).filter(Boolean);
  const country = parts.at(-1);
  if (!country) return null;

  const normalized = normalizeCountry(country);
  if (!normalized) return null;

  return COUNTRY_FLAG_BY_NAME.has(normalized.toLowerCase()) ? normalized : null;
}

function countryFromEndpoint(endpoint: TripRouteEndpoint | null | undefined) {
  if (!endpoint) return null;
  return (
    countryFromMetadata(endpoint.providerMetadata) ||
    countryFromText(endpoint.address) ||
    countryFromText(endpoint.label)
  );
}

function cityFromEndpoint(endpoint: TripRouteEndpoint | null | undefined) {
  if (!endpoint) return null;
  return cityFromMetadata(endpoint.providerMetadata) || cityFromDestination(endpoint.address || endpoint.label);
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
      return type === "country" ? normalizeCountry(value) : value;
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
  if (/^us$/i.test(normalized) || /^usa$/i.test(normalized) || /^united states of america$/i.test(normalized)) {
    return "United States";
  }
  if (/^uk$/i.test(normalized) || /^great britain$/i.test(normalized)) {
    return "United Kingdom";
  }

  return normalized;
}

function flagForCountry(country: string) {
  return COUNTRY_FLAG_BY_NAME.get(country.toLowerCase()) || "🌐";
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

function routeDistanceMiles(route: ReturnType<typeof readTripSegmentRoute>) {
  if (
    typeof route?.origin?.lat !== "number" ||
    typeof route.origin.lng !== "number" ||
    typeof route.destination?.lat !== "number" ||
    typeof route.destination.lng !== "number"
  ) {
    return null;
  }

  return haversineMiles(route.origin.lat, route.origin.lng, route.destination.lat, route.destination.lng);
}

function haversineMiles(latA: number, lngA: number, latB: number, lngB: number) {
  const earthRadiusMiles = 3958.8;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(latB - latA);
  const deltaLng = toRadians(lngB - lngA);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(deltaLng / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function durationBetween(startValue: string | null | undefined, endValue: string | null | undefined) {
  const start = parseDateTime(startValue);
  const end = parseDateTime(endValue);
  if (!start || !end || end.getTime() <= start.getTime()) return 0;
  return end.getTime() - start.getTime();
}

function formatDuration(milliseconds: number) {
  if (!milliseconds) return null;
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.round((milliseconds % 3_600_000) / 60_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function addYear(years: Set<number>, value: string | null | undefined) {
  const date = dateOnly(value);
  if (date) years.add(date.getUTCFullYear());
}

function dateOnly(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function maxDate(a: Date, b: Date) {
  return a.getTime() >= b.getTime() ? a : b;
}

function minDate(a: Date, b: Date) {
  return a.getTime() <= b.getTime() ? a : b;
}

function incrementMap(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) || 0) + 1);
}

function emptyTransportAccumulator(): TransportAccumulator {
  return {
    countries: new Map<string, number>(),
    count: 0,
    distanceMiles: 0,
    durationMs: 0,
    endpointLabels: new Set<string>(),
    hasDistance: false
  };
}

function normalizeKind(value: string | null | undefined) {
  return String(value || "").toLowerCase().trim();
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

function isMissingTripStatsColumn(message: string) {
  return /destination_lat|destination_lng|destination_provider_metadata|column|schema cache|could not find/i.test(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function emptyStats(error: string, selectedYear: number | null): TravelStatsData {
  return {
    countries: [],
    daysTraveling: 0,
    error,
    flags: [],
    selectedYear,
    stats: {
      activities: 0,
      cities: null,
      countries: null,
      daysTraveling: 0,
      flights: 0,
      hotels: 0,
      mapped: 0,
      places: 0,
      trips: 0
    },
    transport: [
      buildTransportCard("air", "In the air", "Airports", emptyTransportAccumulator()),
      buildTransportCard("train", "On the train", "Stations", emptyTransportAccumulator()),
      buildTransportCard("road", "On the road", "Distance", emptyTransportAccumulator())
    ],
    yearOptions: [CURRENT_YEAR]
  };
}
