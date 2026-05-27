import type { TripSegment } from "@/lib/domain/trip";
import type { TripSegmentType } from "@/lib/domain/trip";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { isDemoTripId, isUuid } from "@/lib/server/trip-id";
import { dayIdFromDate, segmentTypeLabel } from "@/lib/ui/timeline";
import type { TimelineDayView, TripTimelineData } from "./types";

type TripRow = {
  destination: string | null;
  name: string;
};

type TripSegmentRow = {
  end_time: string | null;
  id: string;
  inserted_at: string;
  kind: string | null;
  lat: number | null;
  lng: number | null;
  location: string | null;
  notes: string | null;
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
    type: "dinner"
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
      .select("name,destination")
      .eq("id", tripId)
      .eq("user_id", auth.userId)
      .maybeSingle(),
    auth.supabase
      .from("trip_segments")
      .select("id,trip_id,kind,title,location,start_time,end_time,lat,lng,notes,inserted_at")
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

  return buildTimelineData({
    description: `Plans loaded from Supabase for ${(tripResult.data as TripRow).destination || "this trip"}.`,
    segments,
    title: `${(tripResult.data as TripRow).name} itinerary`,
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
      mappedStops: totalItems,
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
    description: "Timeline data will appear after trip segments are available.",
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
    const key = formatDayDate(segment.startAt);
    groups.set(key, [...(groups.get(key) || []), segment]);
  }

  return Array.from(groups.entries()).map(([date, items]) => ({
    date,
    dayNumber: date.slice(4),
    id: dayIdFromDate(date),
    items: items
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .map((segment) => ({
        actionLabel: segment.actionLabel,
        confirmation: segment.confirmation,
        costLabel: segment.costLabel,
        details: segment.details,
        endAt: segment.endAt,
        id: segment.id,
        kind: segment.type,
        lat: segment.lat ?? null,
        lng: segment.lng ?? null,
        location: segment.location,
        meta: segment.meta,
        notes: segment.notes ?? null,
        startAt: segment.startAt,
        status: segment.status === "pending" ? "watch" : segment.status,
        timeRange: formatTimeRange(segment.startAt, segment.endAt),
        title: segment.title,
        typeLabel: segmentTypeLabel(segment.type)
      })),
    label: formatWeekday(items[0]?.startAt || new Date().toISOString()),
    summary: summariesByDate.get(date) || `${items.length} planned item${items.length === 1 ? "" : "s"}`
  }));
}

function mapSegmentRow(
  row: TripSegmentRow,
  budgetBySegment: Map<string, { amount: number; currency: string }>
): TripSegment {
  const kind = mapSegmentKind(row.kind);
  const cost = budgetBySegment.get(row.id);

  return {
    actionLabel: actionLabelForKind(kind),
    confirmation: "Not set",
    costLabel: cost ? formatMoney(cost.amount, cost.currency) : "$0",
    details: buildDetails(row),
    endAt: row.end_time,
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    location: row.location || "Location not set",
    meta: segmentTypeLabel(kind),
    notes: row.notes,
    startAt: row.start_time || row.inserted_at,
    status: row.start_time ? "confirmed" : "watch",
    title: row.title,
    tripId: row.trip_id,
    type: kind
  };
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
    case "flight":
      return "flight";
    case "hotel":
    case "lodging":
      return "hotel";
    case "dinner":
    case "restaurant":
      return "dinner";
    case "expense":
      return "expense";
    case "meeting":
    case "event":
    case "activity":
    case "ground":
    case "note":
    default:
      return "meeting";
  }
}

function actionLabelForKind(kind: TripSegmentType) {
  switch (kind) {
    case "dinner":
      return "Open reservation";
    case "expense":
      return "Open expense";
    case "flight":
      return "Refresh flight";
    case "hotel":
      return "Open stay";
    case "meeting":
      return "Open details";
    default:
      return "Open details";
  }
}

function buildDetails(row: TripSegmentRow) {
  return [
    row.kind ? `Type: ${row.kind}` : null,
    row.location ? `Location: ${row.location}` : null,
    row.end_time ? `Ends ${formatTime(row.end_time)}` : null
  ].filter((detail): detail is string => Boolean(detail));
}

function formatDayDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(value));
}

function formatWeekday(value: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    weekday: "short"
  }).format(new Date(value));
}

function formatTimeRange(startAt: string, endAt: string | null) {
  const start = formatTime(startAt);

  if (!endAt) {
    return start;
  }

  return `${start} - ${formatTime(endAt)}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC"
  }).format(new Date(value));
}

function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}
