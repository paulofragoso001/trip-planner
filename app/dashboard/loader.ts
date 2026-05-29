import "server-only";

import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";

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
  metrics: DashboardMetricView[];
  recentTrips: DashboardRecentTripView[];
};

type DashboardClient = {
  from: (
    table: "notifications" | "trips" | "trip_segments" | "unfiled_items"
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

  const [tripsResult, tripCountResult, activeTripsResult, segmentsResult, importsResult, alertsResult] =
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
        .from("unfiled_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.userId)
        .in("parse_status", ["needs_review", "ready"]),
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
    importsResult.error,
    alertsResult.error
  ].find(Boolean);

  if (firstError) {
    return emptyDashboardData("Could not load dashboard details right now.");
  }

  const recentTrips = ((tripsResult.data || []) as TripRow[]).map(mapRecentTrip);

  return {
    error: null,
    metrics: [
      { label: "Trips saved", value: String(tripCountResult.count || 0) },
      { label: "Active plans", value: String(activeTripsResult.count || 0) },
      { label: "Stops", value: String(segmentsResult.count || 0) },
      { label: "Ideas waiting", value: String(importsResult.count || 0) },
      { label: "Alerts", value: String(alertsResult.count || 0) }
    ],
    recentTrips
  };
}

function emptyDashboardData(error: string): DashboardData {
  return {
    error,
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
