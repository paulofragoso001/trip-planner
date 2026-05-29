import "server-only";

import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import type { FirstRunState, FirstRunStep } from "@/lib/wayline-onboarding";

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
        .select("id,name,title,start_date,end_date,status")
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

  const firstError = [
    tripsResult.error,
    tripCountResult.error,
    activeTripsResult.error,
    segmentsResult.error,
    mappedSegmentsResult.error,
    importsResult.error,
    socialImportsResult.error,
    approvedPlacesResult.error,
    alertsResult.error
  ].find(Boolean);

  if (firstError) {
    return emptyDashboardData("Could not load dashboard details right now.");
  }

  const recentTrips = ((tripsResult.data || []) as TripRow[]).map(mapRecentTrip);
  const tripCount = tripCountResult.count || 0;
  const segmentCount = segmentsResult.count || 0;
  const mappedSegmentCount = mappedSegmentsResult.count || 0;
  const savedInspirationCount = (importsResult.count || 0) + (socialImportsResult.count || 0);
  const approvedPlacesCount = approvedPlacesResult.count || 0;

  return {
    error: null,
    firstRun: buildFirstRunState({
      approvedPlacesCount,
      mappedSegmentCount,
      savedInspirationCount,
      segmentCount,
      tripCount
    }),
    metrics: [
      { label: "Trips saved", value: String(tripCount) },
      { label: "Active plans", value: String(activeTripsResult.count || 0) },
      { label: "Stops", value: String(segmentCount) },
      { label: "Ideas waiting", value: String(savedInspirationCount) },
      { label: "Alerts", value: String(alertsResult.count || 0) }
    ],
    recentTrips
  };
}

function emptyDashboardData(error: string): DashboardData {
  return {
    error,
    firstRun: emptyFirstRunState(),
    metrics: [
      { label: "Trips saved", value: "0" },
      { label: "Active plans", value: "0" },
      { label: "Stops", value: "0" },
      { label: "Ideas waiting", value: "0" },
      { label: "Alerts", value: "0" }
    ],
    recentTrips: []
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
