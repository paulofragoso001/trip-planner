import "server-only";

import { ApiError } from "@/lib/api/errors";

type SupabaseLike = {
  from: (table: "trip_segments" | "trips") => any;
};

export type RouteSegment = {
  id: string;
  kind: string | null;
  lat: number | null;
  lng: number | null;
  location: string | null;
  position: number | null;
  start_time: string | null;
  title: string;
};

export type RouteWarning = {
  code: "long_distance" | "too_many_stops" | "transit_heavy";
  message: string;
};

export type RouteSummary = {
  day: string;
  estimatedDurationMinutes: number;
  itemCount: number;
  orderedItemIds: string[];
  provider: "estimate" | "google_distance_matrix";
  totalDistanceMeters: number;
  warnings: RouteWarning[];
};

const maxStopsPerDay = 8;
const maxDistanceMetersPerDay = 50_000;
const maxTransitMinutesPerDay = 180;

function logItineraryGeneration(
  event: string,
  details: Record<string, unknown>
) {
  console.info(
    JSON.stringify({
      area: "itinerary_generation",
      event,
      ...details
    })
  );
}

export async function generateSimpleTripItinerary(
  supabase: SupabaseLike,
  userId: string,
  tripId: string
) {
  logItineraryGeneration("itinerary_generation_started", { tripId, userId });

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id,start_date,end_date")
    .eq("id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (tripError) {
    logItineraryGeneration("itinerary_generation_failed", {
      error: tripError.message,
      tripId,
      userId
    });

    throw new ApiError("internal_error", "Could not load trip.", 500, {
      supabaseMessage: tripError.message
    });
  }

  if (!trip) {
    logItineraryGeneration("itinerary_generation_failed", {
      error: "Trip not found.",
      tripId,
      userId
    });

    throw new ApiError("not_found", "Trip not found.", 404);
  }

  const { data, error } = await supabase
    .from("trip_segments")
    .select("id,title,kind,location,start_time,lat,lng,position")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("position", { ascending: true, nullsFirst: false });

  if (error) {
    logItineraryGeneration("itinerary_generation_failed", {
      error: error.message,
      tripId,
      userId
    });

    throw new ApiError("internal_error", "Could not load trip segments.", 500, {
      supabaseMessage: error.message
    });
  }

  const segments = ((data || []) as RouteSegment[]).sort(compareByPositionThenTime);
  const dates = buildTripDates(trip.start_date, trip.end_date);
  const updates: Array<{ id: string; position: number; startTime: string | null }> = [];
  const dayPlans = buildDayPlans(segments, dates);
  const orderedSegments = dayPlans.flatMap((plan) => plan.segments);

  for (let index = 0; index < orderedSegments.length; index += 1) {
    const segment = orderedSegments[index];
    const day = findDayForSegment(dayPlans, segment.id) || dates[0];
    const dayIndex = dayPlans.find((plan) => plan.day === day)?.segments.findIndex(
      (item) => item.id === segment.id
    ) ?? index;
    const startTime = buildDefaultTime(day, dayIndex);

    updates.push({
      id: segment.id,
      startTime,
      position: index
    });

    await supabase
      .from("trip_segments")
      .update({
        position: index,
        start_time: startTime
      })
      .eq("id", segment.id)
      .eq("user_id", userId);
  }

  const routeSummary = await summarizeRoutesWithProvider(
    orderedSegments.map((segment, index) => ({
      ...segment,
      start_time: updates[index]?.startTime || segment.start_time
    }))
  );

  logItineraryGeneration("itinerary_generation_completed", {
    assigned: updates.length,
    routeDays: routeSummary.length,
    tripId,
    userId
  });

  return {
    assigned: updates.length,
    routeSummary,
    tripId
  };
}

export function summarizeEstimatedRoutes(segments: RouteSegment[]): RouteSummary[] {
  return summarizeRouteGroups(groupByDay(segments), "estimate");
}

function compareByPositionThenTime(a: RouteSegment, b: RouteSegment) {
  const positionDiff = Number(a.position ?? Number.MAX_SAFE_INTEGER) - Number(b.position ?? Number.MAX_SAFE_INTEGER);
  if (positionDiff !== 0) return positionDiff;
  if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time);
  if (a.start_time !== b.start_time) return a.start_time ? -1 : 1;
  return Number(a.position || 0) - Number(b.position || 0);
}

function buildTripDates(startDate: string | null, endDate: string | null) {
  if (!startDate) return [new Date().toISOString().slice(0, 10)];
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : start;
  const dates = [];

  for (
    const cursor = new Date(start);
    cursor.getTime() <= end.getTime() && dates.length < 30;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    dates.push(cursor.toISOString().slice(0, 10));
  }

  return dates.length ? dates : [start.toISOString().slice(0, 10)];
}

function buildDefaultTime(day: string, index: number) {
  const date = new Date(`${day}T09:00:00.000Z`);
  date.setUTCHours(9 + (index % 8), 0, 0, 0);
  return date.toISOString();
}

function buildDayPlans(segments: RouteSegment[], dates: string[]) {
  const plans = dates.map((day) => ({ day, segments: [] as RouteSegment[] }));
  const fallbackPlans = plans.length ? plans : [{ day: new Date().toISOString().slice(0, 10), segments: [] as RouteSegment[] }];
  const unscheduled: RouteSegment[] = [];

  for (const segment of segments) {
    const day = segment.start_time?.slice(0, 10);
    const plan = day ? fallbackPlans.find((item) => item.day === day) : null;

    if (plan) {
      plan.segments.push(segment);
    } else {
      unscheduled.push(segment);
    }
  }

  for (const segment of unscheduled) {
    const target = fallbackPlans.reduce((leastFull, candidate) =>
      candidate.segments.length < leastFull.segments.length ? candidate : leastFull
    );
    target.segments.push(segment);
  }

  return fallbackPlans.map((plan) => ({
    day: plan.day,
    segments: orderByNearestNeighbor(plan.segments)
  }));
}

function findDayForSegment(
  dayPlans: Array<{ day: string; segments: RouteSegment[] }>,
  segmentId: string
) {
  return dayPlans.find((plan) => plan.segments.some((segment) => segment.id === segmentId))?.day;
}

function orderByNearestNeighbor(segments: RouteSegment[]) {
  if (segments.length < 3) return [...segments];

  const startIndex = findRouteStartIndex(segments);
  const ordered = [segments[startIndex]];
  const remaining = segments.filter((_, index) => index !== startIndex);

  while (remaining.length) {
    const current = ordered[ordered.length - 1];
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const distance = distanceBetween(current, candidate);
      const comparableDistance = distance > 0 ? distance : Number.POSITIVE_INFINITY;

      if (comparableDistance < nearestDistance) {
        nearestDistance = comparableDistance;
        nearestIndex = index;
      }
    }

    ordered.push(remaining.splice(nearestIndex, 1)[0]);
  }

  return ordered;
}

function findRouteStartIndex(segments: RouteSegment[]) {
  const hotelIndex = segments.findIndex((segment) => {
    const text = `${segment.kind || ""} ${segment.title || ""}`.toLowerCase();
    return hasCoordinates(segment) && /hotel|lodging|stay/.test(text);
  });

  if (hotelIndex >= 0) return hotelIndex;
  const geoIndex = segments.findIndex(hasCoordinates);
  return geoIndex >= 0 ? geoIndex : 0;
}

async function summarizeRoutesWithProvider(segments: RouteSegment[]): Promise<RouteSummary[]> {
  const grouped = groupByDay(segments);
  const summaries: RouteSummary[] = [];

  for (const [day, daySegments] of grouped.entries()) {
    summaries.push(await summarizeRouteDay(day, daySegments));
  }

  return summaries;
}

function groupByDay(segments: RouteSegment[]) {
  const byDay = new Map<string, RouteSegment[]>();

  for (const segment of segments) {
    const day = segment.start_time?.slice(0, 10) || "unscheduled";
    byDay.set(day, [...(byDay.get(day) || []), segment]);
  }

  return byDay;
}

async function summarizeRouteDay(day: string, daySegments: RouteSegment[]): Promise<RouteSummary> {
  const googleSummary = await summarizeWithGoogleDistanceMatrix(day, daySegments);
  if (googleSummary) return googleSummary;
  return summarizeRouteGroup(day, daySegments, "estimate");
}

function summarizeRouteGroups(
  byDay: Map<string, RouteSegment[]>,
  provider: RouteSummary["provider"]
) {
  return Array.from(byDay.entries()).map(([day, daySegments]) =>
    summarizeRouteGroup(day, daySegments, provider)
  );
}

function summarizeRouteGroup(
  day: string,
  daySegments: RouteSegment[],
  provider: RouteSummary["provider"]
): RouteSummary {
  let distanceMeters = 0;

  for (let index = 1; index < daySegments.length; index += 1) {
    distanceMeters += distanceBetween(daySegments[index - 1], daySegments[index]);
  }

  const estimatedDurationMinutes = Math.round(distanceMeters / 80);

  return {
    day,
    estimatedDurationMinutes,
    itemCount: daySegments.length,
    orderedItemIds: daySegments.map((segment) => segment.id),
    provider,
    totalDistanceMeters: Math.round(distanceMeters),
    warnings: buildRouteWarnings(daySegments.length, distanceMeters, estimatedDurationMinutes)
  };
}

async function summarizeWithGoogleDistanceMatrix(
  day: string,
  daySegments: RouteSegment[]
): Promise<RouteSummary | null> {
  const apiKey =
    process.env.GOOGLE_ROUTES_API_KEY ||
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const geoSegments = daySegments.filter(hasCoordinates);

  if (!apiKey || geoSegments.length < 2) return null;

  const origins = geoSegments.slice(0, -1).map(formatLatLng).join("|");
  const destinations = geoSegments.slice(1).map(formatLatLng).join("|");
  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origins);
  url.searchParams.set("destinations", destinations);
  url.searchParams.set("mode", process.env.GOOGLE_ROUTE_MODE || "driving");
  url.searchParams.set("units", "metric");
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;

    const payload = await response.json();
    if (payload.status !== "OK" || !Array.isArray(payload.rows)) return null;

    let distanceMeters = 0;
    let durationSeconds = 0;

    for (let index = 0; index < geoSegments.length - 1; index += 1) {
      const element = payload.rows[index]?.elements?.[index];
      if (element?.status !== "OK") return null;
      distanceMeters += Number(element.distance?.value || 0);
      durationSeconds += Number(element.duration?.value || 0);
    }

    const estimatedDurationMinutes = Math.round(durationSeconds / 60);

    return {
      day,
      estimatedDurationMinutes,
      itemCount: daySegments.length,
      orderedItemIds: daySegments.map((segment) => segment.id),
      provider: "google_distance_matrix",
      totalDistanceMeters: Math.round(distanceMeters),
      warnings: buildRouteWarnings(daySegments.length, distanceMeters, estimatedDurationMinutes)
    };
  } catch {
    return null;
  }
}

function buildRouteWarnings(
  itemCount: number,
  distanceMeters: number,
  durationMinutes: number
): RouteWarning[] {
  const warnings: RouteWarning[] = [];

  if (itemCount > maxStopsPerDay) {
    warnings.push({
      code: "too_many_stops",
      message: `${itemCount} places today. Consider moving a few to another day.`
    });
  }

  if (distanceMeters > maxDistanceMetersPerDay) {
    warnings.push({
      code: "long_distance",
      message: `Route is ${Math.round(distanceMeters / 1000)} km today.`
    });
  }

  if (durationMinutes > maxTransitMinutesPerDay) {
    warnings.push({
      code: "transit_heavy",
      message: `Estimated transit is ${Math.round(durationMinutes / 60)} hours today.`
    });
  }

  return warnings;
}

function distanceBetween(a: RouteSegment, b: RouteSegment) {
  if (
    typeof a.lat !== "number" ||
    typeof a.lng !== "number" ||
    typeof b.lat !== "number" ||
    typeof b.lng !== "number"
  ) {
    return 0;
  }

  const radiusMeters = 6371000;
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return radiusMeters * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function hasCoordinates(segment: RouteSegment) {
  return typeof segment.lat === "number" && typeof segment.lng === "number";
}

function formatLatLng(segment: RouteSegment) {
  return `${segment.lat},${segment.lng}`;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
