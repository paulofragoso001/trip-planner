import "server-only";

import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { isDemoTripId, isUuid } from "@/lib/server/trip-id";
import {
  isRouteKind,
  readTripSegmentRoute,
  routeEndpointLabel,
  routeTitleLabel
} from "@/lib/trip-segment-route";

export type TripOverviewData = {
  actualLabel: string;
  actionSummary: {
    hasFlight: boolean;
    hasLodging: boolean;
    hasRestaurantOrPlace: boolean;
  };
  destination: string;
  error: string | null;
  expenseCategories: Array<{
    amountLabel: string;
    id: string;
    label: string;
  }>;
  hasExpenses: boolean;
  itineraryPreview: Array<{
    id: string;
    isMapped: boolean;
    location: string;
    timeLabel: string;
    title: string;
    typeLabel: string;
  }>;
  mappedCount: number;
  nextUp: {
    id: string;
    location: string;
    timeLabel: string;
    title: string;
    typeLabel: string;
  } | null;
  notes: string | null;
  plannedLabel: string;
  remainingLabel: string;
  routePreview: {
    destinationLabel: string | null;
    id: string;
    metaLabel: string;
    originLabel: string | null;
    routeLabel: string;
    timeLabel: string;
    title: string;
    typeLabel: string;
  } | null;
  segmentCount: number;
  status: string;
  suggestionsCount: number;
  title: string;
  tripId: string;
};

type TripRow = {
  budget: number | string | null;
  destination: string | null;
  name: string;
  notes: string | null;
  status: string | null;
};

type BudgetRow = {
  amount: number | string | null;
  category: string | null;
  currency: string | null;
  record_type: string | null;
};

type SegmentRow = {
  id: string;
  kind: string | null;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  location: string | null;
  provider_metadata?: Record<string, unknown> | null;
  start_time: string | null;
  title: string;
};

export async function loadTripOverviewData(tripId: string): Promise<TripOverviewData> {
  if (isDemoTripId(tripId)) {
    return {
      actualLabel: "$3,870",
      actionSummary: {
        hasFlight: true,
        hasLodging: true,
        hasRestaurantOrPlace: true
      },
      destination: "Barcelona, Spain",
      error: null,
      expenseCategories: [
        { amountLabel: "$1,120", id: "flights", label: "Flights" },
        { amountLabel: "$1,860", id: "lodging", label: "Lodging" },
        { amountLabel: "$520", id: "food", label: "Food" }
      ],
      itineraryPreview: [
        {
          id: "flight-demo",
          isMapped: true,
          location: "Miami International to Barcelona El Prat",
          timeLabel: "9:15 AM",
          title: "MIA to BCN",
          typeLabel: "Flight"
        },
        {
          id: "hotel-arts",
          isMapped: true,
          location: "Hotel Arts Barcelona, Marina 19-21",
          timeLabel: "3:00 PM",
          title: "Hotel Arts check-in",
          typeLabel: "Hotel"
        },
        {
          id: "team-dinner",
          isMapped: true,
          location: "El Born, Barcelona",
          timeLabel: "7:30 PM",
          title: "Team dinner",
          typeLabel: "Restaurant"
        }
      ],
      hasExpenses: true,
      mappedCount: 3,
      nextUp: {
        id: "hotel-arts",
        location: "Hotel Arts Barcelona, Marina 19-21",
        timeLabel: "3:00 PM",
        title: "Hotel Arts check-in",
        typeLabel: "Hotel"
      },
      notes: "Demo workspace",
      plannedLabel: "$4,200",
      remainingLabel: "$330",
      routePreview: {
        destinationLabel: "BCN",
        id: "flight-demo",
        metaLabel: "Flight",
        originLabel: "MIA",
        routeLabel: "MIA to BCN",
        timeLabel: "9:15 AM",
        title: "MIA to BCN",
        typeLabel: "Flight"
      },
      segmentCount: 5,
      status: "On track",
      suggestionsCount: 2,
      title: "Barcelona Work Trip",
      tripId
    };
  }

  if (!isUuid(tripId)) {
    return emptyOverviewData(tripId, "Invalid trip id.");
  }

  const auth = await authorizeDashboardApi();

  if (!auth) {
    return emptyOverviewData(tripId, "Sign in to load trip overview data.");
  }

  const [tripResult, segmentResult, budgetResult, suggestionsResult] = await Promise.all([
    auth.supabase
      .from("trips")
      .select("name,destination,status,budget,notes")
      .eq("id", tripId)
      .eq("user_id", auth.userId)
      .maybeSingle(),
    auth.supabase
      .from("trip_segments")
      .select("id,title,kind,location,start_time,lat,lng,provider_metadata", { count: "exact" })
      .eq("trip_id", tripId)
      .eq("user_id", auth.userId)
      .order("start_time", { ascending: true, nullsFirst: false })
      .limit(8),
    auth.supabase
      .from("budget_records")
      .select("amount,category,currency,record_type")
      .eq("trip_id", tripId)
      .eq("user_id", auth.userId),
    auth.supabase
      .from("trip_recommendations")
      .select("id", { count: "exact", head: true })
      .eq("trip_id", tripId)
      .eq("status", "suggested")
  ]);

  const segmentResultWithFallback =
    segmentResult.error && isMissingLatLngColumns(segmentResult.error.message)
      ? await auth.supabase
          .from("trip_segments")
          .select("id,title,kind,location,start_time,latitude,longitude,provider_metadata", { count: "exact" })
          .eq("trip_id", tripId)
          .eq("user_id", auth.userId)
          .order("start_time", { ascending: true, nullsFirst: false })
          .limit(8)
      : segmentResult;

  if (tripResult.error || segmentResultWithFallback.error || budgetResult.error) {
    return emptyOverviewData(tripId, "Could not load trip overview data.");
  }

  if (!tripResult.data) {
    return emptyOverviewData(tripId, "Trip not found.");
  }

  const trip = tripResult.data as TripRow;
  const budgetRows = (budgetResult.data || []) as BudgetRow[];
  const currency = budgetRows[0]?.currency || "USD";
  const actual = budgetRows
    .filter((row) => row.record_type !== "planned")
    .reduce((total, row) => total + Number(row.amount || 0), 0);
  const planned = Number(trip.budget || 0);
  const segments = (segmentResultWithFallback.data || []) as SegmentRow[];
  const itineraryPreview = segments.slice(0, 5).map(mapSegmentPreview);
  const expenseCategories = groupExpenseCategories(budgetRows, currency).slice(0, 4);

  return {
    actualLabel: formatMoney(actual, currency),
    actionSummary: summarizeSegments(segments),
    destination: trip.destination || "No destination set",
    error: null,
    expenseCategories,
    hasExpenses: actual > 0 || expenseCategories.length > 0,
    itineraryPreview,
    mappedCount: segments.filter(isMappedSegment).length,
    nextUp: itineraryPreview.find((item) => item.timeLabel !== "Anytime") || itineraryPreview[0] || null,
    notes: trip.notes,
    plannedLabel: formatMoney(planned, currency),
    remainingLabel: formatMoney(planned - actual, currency),
    routePreview: mapRoutePreview(segments.find(isOverviewRouteSegment) || null),
    segmentCount: segmentResultWithFallback.count || segments.length,
    status: trip.status || "Planning",
    suggestionsCount: suggestionsResult.error ? 0 : suggestionsResult.count || 0,
    title: trip.name,
    tripId
  };
}

function emptyOverviewData(tripId: string, error: string): TripOverviewData {
  return {
    actualLabel: "$0",
    actionSummary: {
      hasFlight: false,
      hasLodging: false,
      hasRestaurantOrPlace: false
    },
    destination: "Destination unavailable",
    error,
    expenseCategories: [],
    hasExpenses: false,
    itineraryPreview: [],
    mappedCount: 0,
    nextUp: null,
    notes: null,
    plannedLabel: "$0",
    remainingLabel: "$0",
    routePreview: null,
    segmentCount: 0,
    status: "Unavailable",
    suggestionsCount: 0,
    title: "Trip unavailable",
    tripId
  };
}

function mapSegmentPreview(row: SegmentRow) {
  return {
    id: row.id,
    isMapped: isMappedSegment(row),
    location: row.location || "Location not set",
    timeLabel: formatTime(row.start_time),
    title: row.title,
    typeLabel: labelForKind(row.kind)
  };
}

function mapRoutePreview(row: SegmentRow | null) {
  if (!row) return null;

  const route = readTripSegmentRoute(row.provider_metadata);
  const originLabel = routeEndpointLabel(route?.origin) || null;
  const destinationLabel = routeEndpointLabel(route?.destination) || null;
  const typeLabel = route?.mode === "flight" || row.kind === "flight"
    ? "Flight"
    : labelForKind(row.kind);
  const metaLabel = [route?.carrier, route?.flightNumber].filter(Boolean).join(" · ") || typeLabel;

  return {
    destinationLabel,
    id: row.id,
    metaLabel,
    originLabel,
    routeLabel: routeTitleLabel(route, row.location || row.title),
    timeLabel: formatTime(row.start_time),
    title: row.title,
    typeLabel
  };
}

function summarizeSegments(rows: SegmentRow[]) {
  return rows.reduce(
    (summary, row) => {
      const kind = String(row.kind || "").toLowerCase();
      const route = readTripSegmentRoute(row.provider_metadata);
      const routeMode = route?.mode || "";
      const label = labelForKind(row.kind).toLowerCase();

      summary.hasFlight ||= kind === "flight" || routeMode === "flight";
      summary.hasLodging ||= /hotel|lodging|stay/.test(`${kind} ${label}`);
      summary.hasRestaurantOrPlace ||= /restaurant|dinner|food|place|activity|attraction|park|landmark/.test(`${kind} ${label}`);
      return summary;
    },
    {
      hasFlight: false,
      hasLodging: false,
      hasRestaurantOrPlace: false
    }
  );
}

function isOverviewRouteSegment(row: SegmentRow) {
  return isRouteKind(row.kind) || Boolean(readTripSegmentRoute(row.provider_metadata));
}

function isMappedSegment(row: SegmentRow) {
  const lat = row.lat ?? row.latitude;
  const lng = row.lng ?? row.longitude;
  return typeof lat === "number" && typeof lng === "number";
}

function isMissingLatLngColumns(message: string) {
  return /lat|lng/i.test(message) && /column|schema cache|could not find/i.test(message);
}

function groupExpenseCategories(rows: BudgetRow[], currency: string) {
  const totals = new Map<string, number>();

  for (const row of rows) {
    if (row.record_type === "planned") continue;
    const key = row.category || "misc";
    totals.set(key, (totals.get(key) || 0) + Number(row.amount || 0));
  }

  return Array.from(totals.entries()).map(([category, amount]) => ({
    amountLabel: formatMoney(amount, currency),
    id: category,
    label: labelForKind(category)
  }));
}

function labelForKind(value: string | null) {
  if (!value) return "Place";

  const normalized = value.toLowerCase();
  if (normalized === "dinner" || normalized === "restaurant" || normalized === "food") {
    return "Restaurant";
  }
  if (normalized === "lodging") return "Hotel";
  if (normalized === "ground") return "Transportation";

  return normalized
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatTime(value: string | null) {
  if (!value) return "Anytime";
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
