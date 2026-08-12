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
import { buildFirstReleaseTripOverviewActions } from "@/lib/trip-overview-feature-scope";
import { tripOverviewCategorySymbol } from "@/lib/trip-overview-category";
import { tripOverviewV1Schema } from "@/lib/contracts/trip-overview-v1";
import { projectCanonicalTripOverview } from "@/lib/trip-overview-presentation";
export { projectCanonicalTripOverview } from "@/lib/trip-overview-presentation";

export type TripOverviewData = {
  canonical: CanonicalTripOverview | null;
  loadState: "loaded" | "partial" | "error";
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
  recentItems: Array<{
    createdAt: string;
    href: string;
    id: string;
    title: string;
    typeLabel: string;
  }>;
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

export type OverviewSectionState = "available" | "empty" | "failed";

export type CanonicalTripOverview = {
  version: 1;
  trip: {
    id: string;
    title: string;
    destination: string;
    countryCode: string | null;
    startDate: string | null;
    endDate: string | null;
    dateRange: string;
    relativeTiming: string | null;
    durationDays: number | null;
    status: string;
  };
  hero: {
    imageUrl: string | null;
    alt: string;
    attribution: string | null;
    sourceLabel: string | null;
    fallbackColor: string;
  };
  itinerarySummary: {
    state: OverviewSectionState;
    error: string | null;
    exactCount: number;
    dateRange: string;
    categories: Array<{ key: string; label: string; count: number; icon: string }>;
  };
  documentsPreview: {
    state: OverviewSectionState;
    error: string | null;
    items: Array<{
      id: string;
      title: string;
      type: string;
      date: string | null;
      href: string;
    }>;
  };
  expenseSummary: {
    state: OverviewSectionState;
    error: string | null;
    ledger: "budget_records";
    currencies: Array<{
      currency: string;
      total: number;
      totalLabel: string;
      categories: Array<{ key: string; label: string; amount: number; amountLabel: string }>;
    }>;
  };
  recentItems: {
    state: OverviewSectionState;
    error: string | null;
    items: Array<{
      id: string;
      title: string;
      category: string;
      icon: string;
      createdAt: string;
      href: string;
    }>;
  };
  supportedActions: Array<{
    key: "newActivity" | "places" | "routes" | "flights" | "stays";
    label: string;
    available: boolean;
    href: string | null;
    handoff: "web" | "native-route" | null;
  }>;
  sections: Record<"itinerary" | "documents" | "expenses" | "recentItems", OverviewSectionState>;
};

export type CanonicalTripOverviewResult =
  | { ok: true; data: CanonicalTripOverview }
  | { ok: false; status: 400 | 401 | 404 | 500; error: string };

type TripRow = {
  budget: number | string | null;
  destination: string | null;
  end_date: string | null;
  name: string;
  notes: string | null;
  start_date: string | null;
  status: string | null;
  destination_provider_metadata?: Record<string, unknown> | null;
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
  created_at?: string | null;
};

export async function loadCanonicalTripOverview(
  tripId: string
): Promise<CanonicalTripOverviewResult> {
  if (!isUuid(tripId) && !isDemoTripId(tripId)) {
    return { ok: false, status: 400, error: "Invalid trip id." };
  }

  if (isDemoTripId(tripId)) {
    return { ok: true, data: buildCanonicalDemoOverview(tripId) };
  }

  const auth = await authorizeDashboardApi();
  if (!auth) return { ok: false, status: 401, error: "Authentication required." };

  const tripResult = await auth.supabase
    .from("trips")
    .select("name,destination,status,start_date,end_date,destination_provider_metadata")
    .eq("id", tripId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (tripResult.error) {
    return { ok: false, status: 500, error: "Could not load trip overview." };
  }
  if (!tripResult.data) return { ok: false, status: 404, error: "Trip not found." };

  const [segmentsResult, budgetsResult, documentsResult] = await Promise.all([
    auth.supabase
      .from("trip_segments")
      .select("id,title,kind,start_time,created_at", { count: "exact" })
      .eq("trip_id", tripId)
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false, nullsFirst: false }),
    auth.supabase
      .from("budget_records")
      .select("amount,category,currency,record_type")
      .eq("trip_id", tripId)
      .eq("user_id", auth.userId),
    auth.supabase
      .from("unfiled_items")
      .select("id,title,source_type,source_label,date_time,created_at")
      .eq("trip_id", tripId)
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(3)
  ]);

  const trip = tripResult.data as TripRow;
  const segments = segmentsResult.error ? [] : (segmentsResult.data || []) as SegmentRow[];
  const budgets = budgetsResult.error ? [] : (budgetsResult.data || []) as BudgetRow[];
  const documents = documentsResult.error ? [] : (documentsResult.data || []) as DocumentRow[];
  const hero = getTripHeroImage({ destination: trip.destination, name: trip.name }, []);
  const itineraryState = sectionState(segmentsResult.error, segments.length);
  const documentsState = sectionState(documentsResult.error, documents.length);
  const expensesState = sectionState(budgetsResult.error, budgets.filter((row) => row.record_type !== "planned").length);
  const recent = segments
    .filter((row): row is SegmentRow & { created_at: string } => Boolean(row.created_at))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
    .slice(0, 5);
  const recentState = segmentsResult.error ? "failed" : recent.length ? "available" : "empty";
  const metadata = trip.destination_provider_metadata;
  const countryCode = normalizeCountryCode(metadata?.countryCode ?? metadata?.country_code);
  const base = `/dashboard/trips/${encodeURIComponent(tripId)}`;

  return {
    ok: true,
    data: {
      version: 1,
      trip: {
        id: tripId,
        title: trip.name,
        destination: trip.destination || "No destination set",
        countryCode,
        startDate: trip.start_date,
        endDate: trip.end_date,
        dateRange: formatDateRange(trip.start_date, trip.end_date),
        relativeTiming: formatTripStatus(trip.start_date, trip.end_date, null),
        durationDays: inclusiveDurationDays(trip.start_date, trip.end_date),
        status: trip.status || "Planning"
      },
      hero: {
        imageUrl: hero.imageUrl,
        alt: hero.imageAlt,
        attribution: hero.imageAttribution,
        sourceLabel: hero.imageSourceLabel,
        fallbackColor: "#201f20"
      },
      itinerarySummary: {
        state: itineraryState,
        error: sectionError(segmentsResult.error),
        exactCount: segmentsResult.error ? 0 : segmentsResult.count || segments.length,
        dateRange: formatDateRange(trip.start_date, trip.end_date),
        categories: groupItineraryCategories(segments)
      },
      documentsPreview: {
        state: documentsState,
        error: sectionError(documentsResult.error),
        items: documents.map((row) => ({
          id: row.id,
          title: cleanString(row.title) || cleanString(row.source_label) || labelForDocumentType(row.source_type),
          type: labelForDocumentType(row.source_type),
          date: row.date_time || row.created_at,
          href: `${base}/documents`
        }))
      },
      expenseSummary: {
        state: expensesState,
        error: sectionError(budgetsResult.error),
        ledger: "budget_records",
        currencies: groupExpensesByCurrency(budgets)
      },
      recentItems: {
        state: recentState,
        error: sectionError(segmentsResult.error),
        items: recent.map((row) => ({
          id: row.id,
          title: row.title,
          category: labelForKind(row.kind),
          icon: itineraryIcon(row.kind),
          createdAt: row.created_at,
          href: `${base}/timeline#${row.id}`
        }))
      },
      supportedActions: buildFirstReleaseTripOverviewActions(base),
      sections: {
        itinerary: itineraryState,
        documents: documentsState,
        expenses: expensesState,
        recentItems: recentState
      }
    }
  };
}

export async function loadTripOverviewData(tripId: string): Promise<TripOverviewData> {
  const result = await loadCanonicalTripOverview(tripId);
  if (!result.ok) return emptyOverviewData(tripId, result.error);

  const parsed = tripOverviewV1Schema.safeParse(result.data);
  return parsed.success
    ? projectCanonicalTripOverview(parsed.data)
    : emptyOverviewData(tripId, "Trip overview returned an invalid canonical response.");
}

function emptyOverviewData(tripId: string, error: string): TripOverviewData {
  return {
    canonical: null,
    loadState: "error",
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
    recentItems: [],
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

function sectionState(error: { message?: string } | null, count: number): OverviewSectionState {
  if (error) return "failed";
  return count > 0 ? "available" : "empty";
}

function sectionError(error: { message?: string } | null) {
  return error ? "This section is temporarily unavailable." : null;
}

function normalizeCountryCode(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function inclusiveDurationDays(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) return null;
  const start = startOfUtcDay(new Date(`${startDate}T00:00:00Z`));
  const end = startOfUtcDay(new Date(`${endDate}T00:00:00Z`));
  if (end < start) return null;
  return dayDiff(start, end) + 1;
}

function itineraryIcon(kind: string | null) {
  return tripOverviewCategorySymbol(kind || "place");
}

function groupItineraryCategories(rows: SegmentRow[]) {
  const totals = new Map<string, { label: string; count: number; icon: string }>();
  for (const row of rows) {
    const key = normalizeExpenseCategory(row.kind);
    const current = totals.get(key);
    totals.set(key, {
      label: labelForKind(row.kind),
      count: (current?.count || 0) + 1,
      icon: itineraryIcon(row.kind)
    });
  }
  return Array.from(totals.entries())
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function groupExpensesByCurrency(rows: BudgetRow[]) {
  const currencies = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (row.record_type === "planned") continue;
    const currency = /^[A-Z]{3}$/.test(String(row.currency || "").toUpperCase())
      ? String(row.currency).toUpperCase()
      : "USD";
    const category = normalizeExpenseCategory(row.category);
    const categories = currencies.get(currency) || new Map<string, number>();
    categories.set(category, (categories.get(category) || 0) + Number(row.amount || 0));
    currencies.set(currency, categories);
  }

  return Array.from(currencies.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, categories]) => {
      const categoryRows = Array.from(categories.entries())
        .map(([key, amount]) => ({
          key,
          label: labelForExpenseCategory(key),
          amount,
          amountLabel: formatMoney(amount, currency)
        }))
        .sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key));
      const total = categoryRows.reduce((sum, row) => sum + row.amount, 0);
      return { currency, total, totalLabel: formatMoney(total, currency), categories: categoryRows };
    });
}

function buildCanonicalDemoOverview(tripId: string): CanonicalTripOverview {
  const base = `/dashboard/trips/${encodeURIComponent(tripId)}`;
  return {
    version: 1,
    trip: {
      id: tripId,
      title: "Barcelona Work Trip",
      destination: "Barcelona, Spain",
      countryCode: "ES",
      startDate: "2026-06-11",
      endDate: "2026-06-17",
      dateRange: "Jun 11 - Jun 17",
      relativeTiming: formatTripStatus("2026-06-11", "2026-06-17", null),
      durationDays: 7,
      status: "On track"
    },
    hero: {
      imageUrl: null,
      alt: "Barcelona Work Trip background",
      attribution: null,
      sourceLabel: null,
      fallbackColor: "#201f20"
    },
    itinerarySummary: {
      state: "available",
      error: null,
      exactCount: 5,
      dateRange: "Jun 11 - Jun 17",
      categories: [
        { key: "flight", label: "Flight", count: 1, icon: "airplane" },
        { key: "lodging", label: "Hotel", count: 1, icon: "bed.double" },
        { key: "restaurant", label: "Restaurant", count: 1, icon: "fork.knife" },
        { key: "transport", label: "Transportation", count: 1, icon: "point.topleft.down.to.point.bottomright.curvepath" },
        { key: "activity", label: "Activity", count: 1, icon: "mappin" }
      ]
    },
    documentsPreview: { state: "empty", error: null, items: [] },
    expenseSummary: {
      state: "available",
      error: null,
      ledger: "budget_records",
      currencies: [{
        currency: "USD",
        total: 3617,
        totalLabel: "$3,617.00",
        categories: [
          { key: "lodging", label: "Lodging", amount: 2500, amountLabel: "$2,500.00" },
          { key: "flight", label: "Flight", amount: 1075, amountLabel: "$1,075.00" },
          { key: "bar-party", label: "Bar & Party", amount: 42, amountLabel: "$42.00" }
        ]
      }]
    },
    recentItems: { state: "empty", error: null, items: [] },
    supportedActions: buildFirstReleaseTripOverviewActions(base),
    sections: { itinerary: "available", documents: "empty", expenses: "available", recentItems: "empty" }
  };
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
