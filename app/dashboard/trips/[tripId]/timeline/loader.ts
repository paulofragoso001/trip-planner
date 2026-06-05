import type { TripSegment } from "@/lib/domain/trip";
import type { TripSegmentType } from "@/lib/domain/trip";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { summarizeEstimatedRoutes } from "@/lib/server/itinerary-generator";
import { isDemoTripId, isUuid } from "@/lib/server/trip-id";
import { buildPlacePhotoUrl, readProviderPhoto } from "@/lib/travel-data/photo-url";
import {
  readTripSegmentRoute,
  routeLocationLabel,
  routeTitleLabel
} from "@/lib/trip-segment-route";
import { dayIdFromDate, segmentTypeLabel } from "@/lib/ui/timeline";
import type { TimelineDayView, TripTimelineData } from "./types";

type TripRow = {
  destination: string | null;
  end_date?: string | null;
  name: string;
  start_date?: string | null;
};

type TripSegmentRow = {
  booking_url: string | null;
  confirmation_code: string | null;
  end_time: string | null;
  id: string;
  inserted_at: string;
  kind: string | null;
  lat: number | null;
  lng: number | null;
  location: string | null;
  location_status: string | null;
  notes: string | null;
  position: number | null;
  provider: string | null;
  provider_metadata: Record<string, unknown> | null;
  start_time: string | null;
  title: string;
  trip_id: string;
};

type BudgetRecordRow = {
  amount: number | string | null;
  currency: string | null;
  segment_id: string | null;
};

const demoSegments: Omit<TripSegment, "tripId">[] = [
  {
    actionLabel: "View boarding pass",
    confirmation: "AA-G7K92P",
    costLabel: "$1,120",
    details: ["Gate D42", "Terminal North", "Seat 12A", "Baggage claim 7"],
    endAt: "2026-06-11T23:05:00.000Z",
    id: "flight-demo",
    location: "Miami International to Barcelona El Prat",
    meta: "American Airlines AA112",
    startAt: "2026-06-11T09:15:00.000Z",
    status: "watch",
    title: "MIA to BCN",
    type: "flight"
  },
  {
    actionLabel: "Open reservation",
    confirmation: "HA-48211",
    costLabel: "$1,860",
    details: ["Check-in 3:00 PM", "Room: Deluxe Sea View", "Late arrival noted"],
    endAt: null,
    id: "hotel-arts",
    location: "Hotel Arts Barcelona, Marina 19-21",
    meta: "4 nights",
    startAt: "2026-06-11T15:00:00.000Z",
    status: "confirmed",
    title: "Hotel Arts check-in",
    type: "hotel"
  },
  {
    actionLabel: "Show map",
    confirmation: "RSVP-TEAM",
    costLabel: "$420",
    details: ["Table for 6", "Vegetarian options confirmed", "Linked expense ready"],
    endAt: null,
    id: "team-dinner",
    location: "El Born, Barcelona",
    meta: "Team dinner",
    startAt: "2026-06-11T19:30:00.000Z",
    status: "synced",
    title: "Team dinner",
    type: "restaurant"
  },
  {
    actionLabel: "Add notes",
    confirmation: "MEET-BCN-01",
    costLabel: "$0",
    details: ["Agenda attached", "Ana editing", "Calendar sync pending"],
    endAt: "2026-06-12T12:30:00.000Z",
    id: "client-meeting",
    location: "Passeig de Gracia office",
    meta: "Client workshop",
    startAt: "2026-06-12T10:00:00.000Z",
    status: "confirmed",
    title: "Client planning session",
    type: "meeting"
  },
  {
    actionLabel: "Attach receipt",
    confirmation: "EXP-FOOD",
    costLabel: "$86",
    details: ["Budget category: Food", "Receipt missing", "Paid by Paulo"],
    endAt: null,
    id: "lunch-expense",
    location: "Eixample, Barcelona",
    meta: "Expense linked",
    startAt: "2026-06-12T13:15:00.000Z",
    status: "watch",
    title: "Working lunch",
    type: "expense"
  }
];

const summariesByDate = new Map([
  ["Jun 11", "Arrival, hotel check-in, and team dinner"],
  ["Jun 12", "Client meetings and product review"]
]);

export async function loadTripTimelineData(tripId: string): Promise<TripTimelineData> {
  if (isDemoTripId(tripId)) {
    return buildTimelineData({
      description:
        "Confirmation numbers, check-in windows, calendar status, and receipts in one traveler-facing timeline.",
      segments: demoSegments.map((segment) => ({ ...segment, tripId })),
      title: "Barcelona itinerary",
      tripId
    });
  }

  if (!isUuid(tripId)) {
    return emptyTimelineData(tripId, "Invalid trip id.");
  }

  const auth = await authorizeDashboardApi();

  if (!auth) {
    return emptyTimelineData(tripId, "Sign in to load trip calendar segments.");
  }

  const [tripResult, segmentResult, budgetResult] = await Promise.all([
      auth.supabase
        .from("trips")
        .select("name,destination,start_date,end_date")
        .eq("id", tripId)
        .eq("user_id", auth.userId)
        .maybeSingle(),
    auth.supabase
      .from("trip_segments")
      .select("id,trip_id,kind,title,location,start_time,end_time,lat,lng,notes,position,inserted_at,provider,provider_metadata,confirmation_code,booking_url,location_status")
      .eq("trip_id", tripId)
      .eq("user_id", auth.userId)
      .order("start_time", { ascending: true, nullsFirst: false })
      .order("inserted_at", { ascending: true }),
    auth.supabase
      .from("budget_records")
      .select("segment_id,amount,currency")
      .eq("trip_id", tripId)
      .eq("user_id", auth.userId)
  ]);

  if (tripResult.error || segmentResult.error) {
    return emptyTimelineData(tripId, "Could not load trip calendar segments.");
  }

  if (!tripResult.data) {
    return emptyTimelineData(tripId, "Trip not found.");
  }

  const budgetBySegment = buildBudgetBySegment((budgetResult.data || []) as BudgetRecordRow[]);
  const segments = ((segmentResult.data || []) as TripSegmentRow[]).map((row) =>
    mapSegmentRow(row, budgetBySegment)
  );

  const trip = tripResult.data as TripRow;

  return buildTimelineData({
    description: formatTripSubtitle(trip),
    segments,
    title: trip.name,
    tripId
  });
}

function buildTimelineData({
  description,
  segments,
  title,
  tripId
}: {
  description: string;
  segments: TripSegment[];
  title: string;
  tripId: string;
}): TripTimelineData {
  const days = groupSegmentsByDay(segments);
  const totalItems = days.reduce((total, day) => total + day.items.length, 0);
  const readyItems = days
    .flatMap((day) => day.items)
    .filter((item) => item.status === "confirmed" || item.status === "synced").length;
  const alerts = days
    .flatMap((day) => day.items)
    .filter((item) => item.status === "watch").length;
  const mappedStops = days
    .flatMap((day) => day.items)
    .filter((item) => item.lat !== null && item.lng !== null).length;

  return {
    dayTabs: days.map((day) => ({
      count: day.items.length,
      date: day.date,
      href: `#${day.id}`,
      label: day.label
    })),
    days,
    description,
    error: null,
    firstFlight: days.flatMap((day) => day.items).find((item) => item.kind === "flight") ?? null,
    stats: {
      alerts,
      mappedStops,
      readyItems,
      totalItems
    },
    title,
    tripId
  };
}

function emptyTimelineData(tripId: string, error: string): TripTimelineData {
  return {
    dayTabs: [],
    days: [],
    description: "Your itinerary will appear after places are available.",
    error,
    firstFlight: null,
    stats: {
      alerts: 0,
      mappedStops: 0,
      readyItems: 0,
      totalItems: 0
    },
    title: "Trip itinerary",
    tripId
  };
}

function groupSegmentsByDay(segments: TripSegment[]): TimelineDayView[] {
  const groups = new Map<string, TripSegment[]>();

  for (const segment of segments) {
    const key = segment.startAt ? formatDayKey(segment.startAt) : "unscheduled";
    groups.set(key, [...(groups.get(key) || []), segment]);
  }

  return Array.from(groups.entries()).map(([date, items]) => {
    const orderedItems = items
      .sort(compareSegmentsForTimeline)
      .map((segment) => ({
        actionLabel: segment.actionLabel,
        bookingUrl: readExtra(segment, "bookingUrl"),
        confirmation: segment.confirmation,
        confirmationCode: readExtra(segment, "confirmationCode"),
        costLabel: segment.costLabel,
        details: segment.details,
        displayDate: segment.startAt ? formatDayHeader(segment.startAt) : "Unscheduled",
        durationLabel: segment.startAt && segment.endAt ? formatDurationBetween(segment.startAt, segment.endAt) : null,
        endAt: segment.endAt,
        id: segment.id,
        imageAlt: readExtra(segment, "imageAlt"),
        imageAttribution: readExtra(segment, "imageAttribution"),
        imageUrl: readExtra(segment, "imageUrl"),
        hasEndTime: Boolean(segment.hasEndTime),
        hasStartTime: Boolean(segment.hasStartTime),
        kind: segment.type,
        lat: segment.lat ?? null,
        lng: segment.lng ?? null,
        location: segment.location,
        locationStatus: readExtra(segment, "locationStatus") || inferLocationStatus(segment),
        meta: segment.meta,
        notes: segment.notes ?? null,
        provider: readExtra(segment, "provider"),
        providerMetadata: readRecordExtra(segment, "providerMetadata"),
        route: segment.route || null,
        startAt: segment.startAt,
        status: segment.status === "pending" ? "watch" : segment.status,
        timeRange: formatTimeRange(
          segment.startAt,
          segment.endAt,
          Boolean(segment.hasStartTime),
          Boolean(segment.hasEndTime)
        ),
        timeZoneLabel: "Local time",
        title: segment.route ? routeTitleLabel(segment.route, segment.title) : segment.title,
        typeLabel: segmentTypeLabel(segment.type)
      }));
    const routeSummary = summarizeEstimatedRoutes(
      items.map((segment, index) => ({
        id: segment.id,
        kind: segment.type,
        lat: segment.lat ?? null,
        lng: segment.lng ?? null,
        location: segment.location,
        position: index,
        start_time: segment.startAt,
        title: segment.title
      }))
    )[0];

    return {
      date: date === "unscheduled" ? "Unscheduled" : formatDayHeader(items[0]?.startAt || new Date().toISOString()),
      dateIso: date === "unscheduled" ? null : date,
      dayNumber: date === "unscheduled" ? "" : formatDayNumber(items[0]?.startAt || new Date().toISOString()),
      id: date === "unscheduled" ? "unscheduled" : dayIdFromDate(date),
      items: orderedItems,
      label: date === "unscheduled" ? "Ideas" : formatWeekday(items[0]?.startAt || new Date().toISOString()),
      routeSummary: {
        estimatedDurationMinutes: routeSummary?.estimatedDurationMinutes || 0,
        provider: routeSummary?.provider || "estimate",
        totalDistanceMeters: routeSummary?.totalDistanceMeters || 0,
        warnings: routeSummary?.warnings || []
      },
      summary: date === "unscheduled"
        ? "Add a date or time when you are ready."
        : summariesByDate.get(formatShortDay(items[0]?.startAt || new Date().toISOString())) || `${items.length} planned place${items.length === 1 ? "" : "s"}`
    };
  });
}

function mapSegmentRow(
  row: TripSegmentRow,
  budgetBySegment: Map<string, { amount: number; currency: string }>
): TripSegment {
  const kind = mapSegmentKind(row.kind);
  const cost = budgetBySegment.get(row.id);
  const photo = readProviderPhoto(row.provider_metadata);
  const schedule = readScheduleMetadata(row.provider_metadata, row.start_time, row.end_time);
  const route = readTripSegmentRoute(row.provider_metadata);

  return {
    actionLabel: actionLabelForKind(kind),
    confirmation: row.confirmation_code || "Not set",
    costLabel: cost ? formatMoney(cost.amount, cost.currency) : "$0",
    details: buildDetails(row, schedule, route),
    endAt: route?.arriveAt || row.end_time,
    id: row.id,
    imageAlt: photo?.imageAlt || null,
    imageAttribution: photo?.attribution || null,
    imageUrl: buildPlacePhotoUrl(row.provider_metadata, 400),
    hasEndTime: schedule.hasEndTime,
    hasStartTime: schedule.hasStartTime,
    insertedAt: row.inserted_at,
    lat: row.lat,
    lng: row.lng,
    location: route ? routeLocationLabel(route) || row.location || "Route details not set" : row.location || "Location not set",
    meta: route?.carrier || route?.flightNumber || segmentTypeLabel(kind),
    notes: row.notes,
    position: row.position,
    route,
    startAt: route?.departAt || row.start_time,
    status: statusForRow(row),
    title: route ? routeTitleLabel(route, row.title) : row.title,
    tripId: row.trip_id,
    type: kind,
    bookingUrl: row.booking_url,
    confirmationCode: row.confirmation_code,
    locationStatus: row.location_status || inferRowLocationStatus(row),
    provider: row.provider,
    providerMetadata: row.provider_metadata
  } as TripSegment & {
    bookingUrl: string | null;
    confirmationCode: string | null;
    locationStatus: string;
    provider: string | null;
    providerMetadata: Record<string, unknown> | null;
  };
}

function compareSegmentsForTimeline(a: TripSegment, b: TripSegment) {
  const dateCompare = sortableDay(a.startAt).localeCompare(sortableDay(b.startAt));
  if (dateCompare !== 0) return dateCompare;

  if (a.hasStartTime && b.hasStartTime && a.startAt && b.startAt) {
    const timeCompare = a.startAt.localeCompare(b.startAt);
    if (timeCompare !== 0) return timeCompare;
  }

  if (a.hasStartTime !== b.hasStartTime) return a.hasStartTime ? -1 : 1;

  const positionCompare = sortableNumber(a.position) - sortableNumber(b.position);
  if (positionCompare !== 0) return positionCompare;

  return sortableDate(a.insertedAt).localeCompare(sortableDate(b.insertedAt));
}

function sortableDay(value: string | null | undefined) {
  return value?.slice(0, 10) || "9999-12-31";
}

function sortableDate(value: string | null | undefined) {
  return value || "9999-12-31T23:59:59.999Z";
}

function sortableNumber(value: number | null | undefined) {
  return typeof value === "number" ? value : Number.MAX_SAFE_INTEGER;
}

function buildBudgetBySegment(rows: BudgetRecordRow[]) {
  const result = new Map<string, { amount: number; currency: string }>();

  for (const row of rows) {
    if (!row.segment_id) {
      continue;
    }

    const current = result.get(row.segment_id);
    result.set(row.segment_id, {
      amount: (current?.amount || 0) + Number(row.amount || 0),
      currency: current?.currency || row.currency || "USD"
    });
  }

  return result;
}

function mapSegmentKind(value: string | null): TripSegmentType {
  switch ((value || "").toLowerCase()) {
    case "air":
    case "flight":
      return "flight";
    case "hotel":
    case "lodging":
      return "hotel";
    case "dinner":
    case "restaurant":
      return "restaurant";
    case "expense":
      return "expense";
    case "drive":
    case "train":
    case "bus":
    case "transfer":
    case "ferry":
    case "transport":
    case "transportation":
      return "transport";
    case "activity":
    case "tour":
      return "activity";
    case "place":
    case "park":
    case "landmark":
    case "attraction":
    case "neighborhood":
      return "place";
    case "meeting":
    case "event":
      return "meeting";
    case "ground":
    case "note":
    default:
      return "place";
  }
}

function actionLabelForKind(kind: TripSegmentType) {
  switch (kind) {
    case "activity":
      return "Open activity";
    case "expense":
      return "Open expense";
    case "flight":
      return "Refresh flight";
    case "hotel":
      return "Open stay";
    case "meeting":
      return "Open details";
    case "place":
      return "Open place";
    case "restaurant":
      return "Open reservation";
    case "transport":
      return "Open route";
    default:
      return "Open details";
  }
}

function buildDetails(
  row: TripSegmentRow,
  schedule: { hasEndTime: boolean; hasStartTime: boolean },
  route: ReturnType<typeof readTripSegmentRoute>
) {
  return [
    row.kind ? `Type: ${row.kind}` : null,
    route?.origin ? `From: ${route.origin.label || route.origin.address || "Origin"}` : null,
    route?.destination ? `To: ${route.destination.label || route.destination.address || "Destination"}` : null,
    route?.flightNumber ? `Flight: ${route.flightNumber}` : null,
    route?.carrier ? `Carrier: ${route.carrier}` : null,
    row.location ? `Location: ${row.location}` : null,
    row.provider ? `Source: ${row.provider}` : null,
    row.end_time && schedule.hasEndTime ? `Ends ${formatTime(row.end_time)}` : null
  ].filter((detail): detail is string => Boolean(detail));
}

function formatDayKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric"
  }).format(new Date(value));
}

function formatShortDay(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(value));
}

function formatDayHeader(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
    year: "numeric"
  }).format(new Date(value)).toUpperCase();
}

function formatDayNumber(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
}

function formatWeekday(value: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    weekday: "short"
  }).format(new Date(value));
}

function formatTimeRange(
  startAt: string | null,
  endAt: string | null,
  hasStartTime: boolean,
  hasEndTime: boolean
) {
  if (!startAt || !hasStartTime) {
    return "Unscheduled";
  }

  const start = formatTime(startAt);

  if (!endAt || !hasEndTime) {
    return start;
  }

  return `${start} - ${formatTime(endAt)}`;
}

function formatTripSubtitle(trip: TripRow) {
  const destination = trip.destination || "Destination not set";
  const range = formatTripDateRange(trip.start_date || null, trip.end_date || null);
  return range ? `${destination} · ${range}` : destination;
}

function formatTripDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) return "";
  if (startDate && !endDate) return formatTripDate(startDate);
  if (!startDate && endDate) return formatTripDate(endDate);
  return `${formatTripDate(startDate!)} - ${formatTripDate(endDate!)}`;
}

function formatTripDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric"
  }).format(new Date(value));
}

function formatDurationBetween(startAt: string, endAt: string) {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  const minutes = Math.round((end - start) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function readExtra(
  segment: TripSegment,
  key: "bookingUrl" | "confirmationCode" | "imageAlt" | "imageAttribution" | "imageUrl" | "locationStatus" | "provider"
) {
  const value = (segment as TripSegment & Record<typeof key, unknown>)[key];
  return typeof value === "string" && value ? value : null;
}

function readRecordExtra(segment: TripSegment, key: "providerMetadata") {
  const value = (segment as TripSegment & Record<typeof key, unknown>)[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function statusForRow(row: TripSegmentRow) {
  if (row.location_status && row.location_status !== "resolved") return "watch";
  if (row.start_time) return "confirmed";
  return "watch";
}

function inferRowLocationStatus(row: TripSegmentRow) {
  if (row.lat !== null && row.lng !== null) return "resolved";
  if ((row.kind || "").toLowerCase().includes("tour") || (row.kind || "").toLowerCase().includes("activity")) {
    return "needs_activity_provider";
  }
  return "needs_location_confirmation";
}

function inferLocationStatus(segment: TripSegment) {
  if (segment.lat !== null && segment.lng !== null) return "resolved";
  return segment.startAt ? "needs_location_confirmation" : "needs_activity_provider";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC"
  }).format(new Date(value));
}

function readScheduleMetadata(
  metadata: Record<string, unknown> | null,
  startTime: string | null,
  endTime: string | null
) {
  const schedule = isRecord(metadata?.schedule) ? metadata.schedule : null;
  const explicitStart = typeof schedule?.hasStartTime === "boolean"
    ? schedule.hasStartTime
    : startTime
      ? !isMidnight(startTime)
      : false;
  const explicitEnd = typeof schedule?.hasEndTime === "boolean"
    ? schedule.hasEndTime
    : endTime
      ? !isMidnight(endTime)
      : false;

  return {
    hasEndTime: explicitEnd,
    hasStartTime: explicitStart
  };
}

function isMidnight(value: string) {
  return value.slice(11, 16) === "00:00";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}
