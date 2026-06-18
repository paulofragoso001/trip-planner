import "server-only";

import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { isDemoTripId, isUuid } from "@/lib/server/trip-id";
import {
  getTripHeroImage,
  type WalletHeroImage,
  type WalletHeroSegment
} from "@/lib/wallet/hero-image";
import {
  isRouteKind,
  readTripSegmentRoute,
  routeEndpointLabel,
  routeTitleLabel,
  type TripRouteEndpoint
} from "@/lib/trip-segment-route";
import type { TripMapItem } from "@/components/TripMap";
import type { MobileFlightRoutePreview } from "@/components/trip/mobile-flight-route-card";

export type TripOverviewData = {
  actualLabel: string;
  actionSummary: {
    hasFlight: boolean;
    hasLodging: boolean;
    hasRestaurantOrPlace: boolean;
  };
  dateRange: string;
  destination: string;
  documentsPreview: Array<{
    href: string;
    id: string;
    metaLabel: string;
    title: string;
    typeLabel: string;
  }>;
  error: string | null;
  expenseCategories: Array<{
    amountLabel: string;
    id: string;
    label: string;
  }>;
  flightPreview: MobileFlightRoutePreview | null;
  hasExpenses: boolean;
  heroImage: WalletHeroImage;
  itineraryPreview: Array<{
    id: string;
    isMapped: boolean;
    location: string;
    timeLabel: string;
    title: string;
    typeLabel: string;
  }>;
  mappedCount: number;
  mapPreviewItems: TripMapItem[];
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
  statusLabel: string | null;
  suggestionsCount: number;
  title: string;
  tripId: string;
};

type TripRow = {
  budget: number | string | null;
  destination: string | null;
  end_date: string | null;
  name: string;
  notes: string | null;
  start_date: string | null;
  status: string | null;
};

type BudgetRow = {
  amount: number | string | null;
  category: string | null;
  currency: string | null;
  record_type: string | null;
};

type DocumentRow = {
  created_at: string | null;
  date_time: string | null;
  id: string;
  location: string | null;
  notes: string | null;
  source_label: string | null;
  source_type: string | null;
  title: string | null;
};

type SegmentRow = {
  booking_url?: string | null;
  confirmation_code?: string | null;
  end_time?: string | null;
  id: string;
  kind: string | null;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  location: string | null;
  notes?: string | null;
  provider?: string | null;
  provider_metadata?: Record<string, unknown> | null;
  provider_place_id?: string | null;
  start_time: string | null;
  title: string;
};

export async function loadTripOverviewData(tripId: string): Promise<TripOverviewData> {
  if (isDemoTripId(tripId)) {
    return {
      actualLabel: "$3,651.00",
      actionSummary: {
        hasFlight: true,
        hasLodging: true,
        hasRestaurantOrPlace: true
      },
      dateRange: "Jun 11 - Jun 17",
      destination: "Barcelona, Spain",
      documentsPreview: [],
      error: null,
      expenseCategories: [
        { amountLabel: "$42.00", id: "bar-party", label: "Bar & Party" },
        { amountLabel: "$1,075.00", id: "flight", label: "Flight" },
        { amountLabel: "$2,500.00", id: "lodging", label: "Lodging" }
      ],
      flightPreview: null,
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
      heroImage: getTripHeroImage(
        { destination: "Barcelona, Spain", name: "Barcelona Work Trip" },
        []
      ),
      mappedCount: 3,
      mapPreviewItems: [
        {
          category: "Airport",
          dayLabel: "Thu",
          id: "flight-demo-origin",
          lat: 25.7959,
          lng: -80.287,
          routeOrder: 1,
          title: "Miami International Airport"
        },
        {
          category: "Hotel",
          dayLabel: "Thu",
          id: "hotel-arts",
          lat: 41.3879,
          lng: 2.1969,
          routeOrder: 2,
          title: "Hotel Arts Barcelona"
        },
        {
          category: "Restaurant",
          dayLabel: "Thu",
          id: "team-dinner",
          lat: 41.3851,
          lng: 2.1734,
          routeOrder: 3,
          title: "Team dinner"
        }
      ],
      nextUp: {
        id: "hotel-arts",
        location: "Hotel Arts Barcelona, Marina 19-21",
        timeLabel: "3:00 PM",
        title: "Hotel Arts check-in",
        typeLabel: "Hotel"
      },
      notes: "Demo workspace",
      plannedLabel: "$4,200.00",
      remainingLabel: "$549.00",
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
      statusLabel: "Happening now",
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

  const [tripResult, segmentResult, budgetResult, suggestionsResult, documentsResult] = await Promise.all([
    auth.supabase
      .from("trips")
      .select("name,destination,status,budget,notes,start_date,end_date")
      .eq("id", tripId)
      .eq("user_id", auth.userId)
      .maybeSingle(),
    auth.supabase
      .from("trip_segments")
      .select(
        "id,title,kind,location,start_time,end_time,lat,lng,provider,provider_place_id,provider_metadata,confirmation_code,booking_url,notes",
        { count: "exact" }
      )
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
      .eq("status", "suggested"),
    auth.supabase
      .from("unfiled_items")
      .select("id,title,source_type,source_label,location,date_time,notes,created_at")
      .eq("trip_id", tripId)
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(3)
  ]);

  const segmentResultWithFallback =
    segmentResult.error && isMissingLatLngColumns(segmentResult.error.message)
      ? await auth.supabase
          .from("trip_segments")
          .select(
            "id,title,kind,location,start_time,end_time,latitude,longitude,provider,provider_place_id,provider_metadata,confirmation_code,booking_url,notes",
            { count: "exact" }
          )
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
  const heroImage = getTripHeroImage(
    {
      destination: trip.destination,
      name: trip.name
    },
    segments as WalletHeroSegment[]
  );

  return {
    actualLabel: formatMoney(actual, currency),
    actionSummary: summarizeSegments(segments),
    dateRange: formatDateRange(trip.start_date, trip.end_date),
    destination: trip.destination || "No destination set",
    documentsPreview: documentsResult.error
      ? []
      : ((documentsResult.data || []) as DocumentRow[]).map((row) => mapDocumentPreview(row, tripId)),
    error: null,
    expenseCategories,
    flightPreview: mapFlightPreview(segments.find(isFlightSegment) || null),
    hasExpenses: actual > 0 || expenseCategories.length > 0,
    heroImage,
    itineraryPreview,
    mappedCount: segments.filter(isMappedSegment).length,
    mapPreviewItems: segments.filter(isMappedSegment).slice(0, 5).map(mapSegmentMapPreview),
    nextUp: itineraryPreview.find((item) => item.timeLabel !== "Anytime") || itineraryPreview[0] || null,
    notes: trip.notes,
    plannedLabel: formatMoney(planned, currency),
    remainingLabel: formatMoney(planned - actual, currency),
    routePreview: mapRoutePreview(segments.find(isOverviewRouteSegment) || null),
    segmentCount: segmentResultWithFallback.count || segments.length,
    status: trip.status || "Planning",
    statusLabel: formatTripStatus(trip.start_date, trip.end_date, trip.status),
    suggestionsCount: suggestionsResult.error ? 0 : suggestionsResult.count || 0,
    title: trip.name,
    tripId
  };
}

function emptyOverviewData(tripId: string, error: string): TripOverviewData {
  return {
    actualLabel: "$0.00",
    actionSummary: {
      hasFlight: false,
      hasLodging: false,
      hasRestaurantOrPlace: false
    },
    dateRange: "Dates unavailable",
    destination: "Destination unavailable",
    documentsPreview: [],
    error,
    expenseCategories: [],
    flightPreview: null,
    hasExpenses: false,
    heroImage: getTripHeroImage({ destination: "Trip", name: "Trip unavailable" }, []),
    itineraryPreview: [],
    mappedCount: 0,
    mapPreviewItems: [],
    nextUp: null,
    notes: null,
    plannedLabel: "$0.00",
    remainingLabel: "$0.00",
    routePreview: null,
    segmentCount: 0,
    status: "Unavailable",
    statusLabel: null,
    suggestionsCount: 0,
    title: "Trip unavailable",
    tripId
  };
}

function mapDocumentPreview(row: DocumentRow, tripId: string) {
  const typeLabel = labelForDocumentType(row.source_type);
  const title = cleanString(row.title) || cleanString(row.source_label) || typeLabel;
  const metaLabel =
    [cleanString(row.location), row.date_time ? formatDate(row.date_time.slice(0, 10)) : null]
      .filter(Boolean)
      .join(" · ") ||
    cleanString(row.notes) ||
    "Trip document";

  return {
    href: `/dashboard/trips/${encodeURIComponent(tripId)}/documents`,
    id: row.id,
    metaLabel,
    title,
    typeLabel
  };
}

function labelForDocumentType(value: string | null | undefined) {
  const normalized = String(value || "").toLowerCase();
  if (/email|gmail|reservation|booking/.test(normalized)) return "Reservation";
  if (/link|url|web|article/.test(normalized)) return "Link";
  if (/image|photo|screenshot/.test(normalized)) return "Photo";
  return "Document";
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

function mapSegmentMapPreview(row: SegmentRow): TripMapItem {
  return {
    category: labelForKind(row.kind),
    dayLabel: row.start_time ? formatDate(row.start_time.slice(0, 10)) : null,
    id: row.id,
    lat: row.lat ?? row.latitude ?? 0,
    lng: row.lng ?? row.longitude ?? 0,
    title: row.title
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

function isFlightSegment(row: SegmentRow) {
  const kind = String(row.kind || "").toLowerCase();
  const route = readTripSegmentRoute(row.provider_metadata);
  return kind === "flight" || route?.mode === "flight";
}

function mapFlightPreview(row: SegmentRow | null): MobileFlightRoutePreview | null {
  if (!row) return null;

  const route = readTripSegmentRoute(row.provider_metadata);
  if (String(row.kind || "").toLowerCase() !== "flight" && route?.mode !== "flight") {
    return null;
  }

  const departAt = route?.departAt || row.start_time;
  const arriveAt = route?.arriveAt || row.end_time || null;
  const hasStartTime = readScheduleFlag(row.provider_metadata, "hasStartTime", Boolean(departAt));
  const hasEndTime = readScheduleFlag(row.provider_metadata, "hasEndTime", Boolean(arriveAt));
  const originLabel = routeEndpointLabel(route?.origin) || null;
  const destinationLabel = routeEndpointLabel(route?.destination) || null;
  const originCode = routeEndpointCode(route?.origin);
  const destinationCode = routeEndpointCode(route?.destination);
  const metaLabel = [route?.carrier, route?.flightNumber].filter(Boolean).join(" ") || "Flight";
  const title = routeTitleLabel(route, row.location || row.title);
  const lat = row.lat ?? row.latitude ?? route?.origin?.lat ?? route?.destination?.lat ?? 0;
  const lng = row.lng ?? row.longitude ?? route?.origin?.lng ?? route?.destination?.lng ?? 0;

  return {
    arriveLabel: hasEndTime ? formatNullableTime(arriveAt) : null,
    dateLabel: departAt ? formatFullDate(departAt) : null,
    departLabel: hasStartTime ? formatNullableTime(departAt) : null,
    destinationCode,
    destinationLabel,
    id: row.id,
    item: {
      address: row.location || null,
      bookingUrl: row.booking_url || null,
      category: "Flight",
      confirmationCode: cleanString(row.confirmation_code) || cleanString(route?.confirmation),
      dayLabel: departAt ? formatDate(departAt.slice(0, 10)) : null,
      endTime: arriveAt,
      hasEndTime,
      hasStartTime,
      id: row.id,
      kind: row.kind || "flight",
      lat,
      lng,
      notes: row.notes || null,
      provider: row.provider || null,
      providerMetadata: row.provider_metadata || null,
      providerPlaceId: row.provider_place_id || null,
      route,
      routeOrder: 1,
      startTime: departAt,
      timeLabel: hasStartTime ? formatNullableTime(departAt) : null,
      title
    },
    metaLabel,
    originCode,
    originLabel,
    title
  };
}

function routeEndpointCode(endpoint: TripRouteEndpoint | null | undefined) {
  return cleanString(endpoint?.code);
}

function readScheduleFlag(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
  fallback: boolean
) {
  const direct = metadata?.[key];
  if (typeof direct === "boolean") return fallback || direct;

  const schedule = metadata?.schedule;
  if (schedule && typeof schedule === "object" && !Array.isArray(schedule)) {
    const nested = (schedule as Record<string, unknown>)[key];
    if (typeof nested === "boolean") return fallback || nested;
  }

  return fallback;
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
    const key = normalizeExpenseCategory(row.category);
    totals.set(key, (totals.get(key) || 0) + Number(row.amount || 0));
  }

  return Array.from(totals.entries()).map(([category, amount]) => ({
    amountLabel: formatMoney(amount, currency),
    id: category,
    label: labelForExpenseCategory(category)
  }));
}

function labelForExpenseCategory(category: string) {
  switch (category) {
    case "activity":
      return "Activity";
    case "bar-party":
      return "Bar & Party";
    case "flight":
      return "Flight";
    case "lodging":
      return "Lodging";
    case "restaurant":
      return "Restaurant";
    case "transport":
      return "Transport";
    default:
      return "Other";
  }
}

function normalizeExpenseCategory(category: string | null | undefined) {
  const normalized = String(category || "misc").toLowerCase();
  if (/flight|air|airport/.test(normalized)) return "flight";
  if (/lodging|hotel|stay|room/.test(normalized)) return "lodging";
  if (/restaurant|food|dining|dinner|lunch|breakfast|meal|potluck/.test(normalized)) return "restaurant";
  if (/bar|nightlife|party|club|drink|cocktail/.test(normalized)) return "bar-party";
  if (/ground|transport|car|train|rail|road|taxi|uber|transfer|bus/.test(normalized)) return "transport";
  if (/activity|place|attraction|museum|tour|event|meeting|park/.test(normalized)) return "activity";
  return "other";
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

function formatNullableTime(value: string | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC"
  }).format(new Date(value));
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short"
  }).format(new Date(value));
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) return "Dates not set";
  if (startDate && !endDate) return formatDate(startDate);
  if (!startDate && endDate) return formatDate(endDate);
  return `${formatDate(startDate!)} - ${formatDate(endDate!)}`;
}

function formatTripStatus(startDate: string | null, endDate: string | null, fallback: string | null) {
  if (!startDate && !endDate) return fallback || null;

  const today = startOfUtcDay(new Date());
  const start = startDate ? startOfUtcDay(new Date(`${startDate}T00:00:00Z`)) : null;
  const end = endDate ? startOfUtcDay(new Date(`${endDate}T00:00:00Z`)) : null;

  if (start && start > today) {
    const days = dayDiff(today, start);
    return days === 1 ? "Starts tomorrow" : `Starts in ${days} days`;
  }

  if (start && end && start <= today && end >= today) {
    return "Happening now";
  }

  if (end && end < today) {
    const days = dayDiff(end, today);
    return days === 1 ? "Ended yesterday" : `Ended ${days} days ago`;
  }

  return fallback || null;
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function dayDiff(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
}
