import "server-only";

import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import type { FirstRunState, FirstRunStep } from "@/lib/wayline-onboarding";
import {
  getFallbackHeroImage,
  getTripHeroImage,
  type WalletHeroImage
} from "@/lib/wallet/hero-image";

export type DashboardMetricView = {
  label: string;
  value: string;
};

export type DashboardRecentTripView = {
  dateRange: string;
  href: string;
  id: string;
  name: string;
  status: string;
};

export type DashboardData = {
  error: string | null;
  firstRun: FirstRunState;
  heroImage: WalletHeroImage;
  metrics: DashboardMetricView[];
  recentTrips: DashboardRecentTripView[];
};

type DashboardClient = {
  from: (
    table:
      | "extracted_places"
      | "imported_social_posts"
      | "notifications"
      | "trips"
      | "trip_segments"
      | "unfiled_items"
  ) => any;
};

type TripRow = {
  destination?: string | null;
  destination_provider_metadata?: Record<string, unknown> | null;
  end_date: string | null;
  id: string;
  name: string | null;
  start_date: string | null;
  status: string | null;
  title: string | null;
};

export async function loadDashboardData(): Promise<DashboardData> {
  const auth = await authorizeDashboardApi<DashboardClient>();

  if (!auth) {
    return emptyDashboardData("Sign in to load dashboard data.");
  }

  const [
    tripsResult,
    tripCountResult,
    activeTripsResult,
    segmentsResult,
    mappedSegmentsResult,
    importsResult,
    socialImportsResult,
    approvedPlacesResult,
    alertsResult
  ] =
    await Promise.all([
      auth.supabase
        .from("trips")
        .select("id,name,title,destination,destination_provider_metadata,start_date,end_date,status")
        .eq("user_id", auth.userId)
        .order("updated_at", { ascending: false })
        .limit(5),
      auth.supabase
        .from("trips")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.userId),
      auth.supabase
        .from("trips")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.userId)
        .neq("status", "Completed"),
      auth.supabase
        .from("trip_segments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.userId),
      auth.supabase
        .from("trip_segments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.userId)
        .not("latitude", "is", null)
        .not("longitude", "is", null),
      auth.supabase
        .from("unfiled_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.userId)
        .in("parse_status", ["needs_review", "ready"]),
      auth.supabase
        .from("imported_social_posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.userId),
      auth.supabase
        .from("extracted_places")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.userId)
        .eq("status", "accepted"),
      auth.supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.userId)
        .is("read_at", null)
    ]);

  logOptionalDashboardErrors({
    activeTrips: activeTripsResult.error,
    alerts: alertsResult.error,
    approvedPlaces: approvedPlacesResult.error,
    importedSocialPosts: socialImportsResult.error,
    trips: tripsResult.error,
    tripCount: tripCountResult.error,
    tripSegments: segmentsResult.error,
    mappedTripSegments: mappedSegmentsResult.error,
    unfiledItems: importsResult.error
  });

  const recentTrips = tripsResult.error ? [] : ((tripsResult.data || []) as TripRow[]).map(mapRecentTrip);
  const tripCount = safeCount(tripCountResult);
  const segmentCount = safeCount(segmentsResult);
  const mappedSegmentCount = safeCount(mappedSegmentsResult);
  const savedInspirationCount = safeCount(importsResult) + safeCount(socialImportsResult);
  const approvedPlacesCount = safeCount(approvedPlacesResult);

  return {
    error: null,
    firstRun: buildFirstRunState({
      approvedPlacesCount,
      mappedSegmentCount,
      savedInspirationCount,
      segmentCount,
      tripCount
    }),
    heroImage: recentTrips.length
      ? getTripHeroImage(tripsResult.error ? {} : ((tripsResult.data || [])[0] as TripRow), [], [])
      : getFallbackHeroImage("Wayline travel wallet", "Wayline travel wallet background"),
    metrics: [
      { label: "Trips saved", value: String(tripCount) },
      { label: "Active plans", value: String(safeCount(activeTripsResult)) },
      { label: "Places", value: String(segmentCount) },
      { label: "Ideas waiting", value: String(savedInspirationCount) },
      { label: "Alerts", value: String(safeCount(alertsResult)) }
    ],
    recentTrips
  };
}

function emptyDashboardData(error: string): DashboardData {
  return {
    error,
    firstRun: emptyFirstRunState(),
    heroImage: getFallbackHeroImage("Wayline travel wallet", "Wayline travel wallet background"),
    metrics: [
      { label: "Trips saved", value: "0" },
      { label: "Active plans", value: "0" },
      { label: "Places", value: "0" },
      { label: "Ideas waiting", value: "0" },
      { label: "Alerts", value: "0" }
    ],
    recentTrips: []
  };
}

function safeCount(result: { count: number | null; error?: unknown }) {
  return result.error ? 0 : result.count || 0;
}

function logOptionalDashboardErrors(errors: Record<string, unknown>) {
  const entries = Object.entries(errors)
    .filter(([, error]) => Boolean(error))
    .map(([query, error]) => ({
      error: sanitizeDashboardError(error),
      query
    }));

  if (entries.length) {
    console.warn("[dashboard] optional dashboard details unavailable", { failures: entries });
  }
}

function sanitizeDashboardError(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: "Unknown dashboard query error" };
  }

  const record = error as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : "Dashboard query failed"
  };
}

function buildFirstRunState({
  approvedPlacesCount,
  mappedSegmentCount,
  savedInspirationCount,
  segmentCount,
  tripCount
}: {
  approvedPlacesCount: number;
  mappedSegmentCount: number;
  savedInspirationCount: number;
  segmentCount: number;
  tripCount: number;
}): FirstRunState {
  const hasSavedInspiration = savedInspirationCount > 0;
  const hasApprovedPlaces = approvedPlacesCount > 0;
  const hasTripPlan = segmentCount > 0;
  const hasMappedStop = mappedSegmentCount > 0;
  const currentStep: FirstRunStep = hasTripPlan || hasMappedStop
    ? "complete"
    : hasApprovedPlaces
      ? "create_trip_plan"
      : hasSavedInspiration
        ? "review_places"
        : "add_inspiration";

  return {
    currentStep,
    hasApprovedPlaces,
    hasMappedStop,
    hasSavedInspiration,
    hasTripPlan,
    isNewUser:
      tripCount === 0 &&
      !hasSavedInspiration &&
      !hasApprovedPlaces &&
      !hasTripPlan &&
      !hasMappedStop
  };
}

function emptyFirstRunState(): FirstRunState {
  return buildFirstRunState({
    approvedPlacesCount: 0,
    mappedSegmentCount: 0,
    savedInspirationCount: 0,
    segmentCount: 0,
    tripCount: 0
  });
}

function mapRecentTrip(row: TripRow): DashboardRecentTripView {
  return {
    dateRange: formatDateRange(row.start_date, row.end_date),
    href: `/dashboard/trips/${row.id}`,
    id: row.id,
    name: row.name || row.title || "Untitled trip",
    status: row.status || "Planning"
  };
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
