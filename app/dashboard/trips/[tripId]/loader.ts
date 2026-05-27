import "server-only";

import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { isDemoTripId, isUuid } from "@/lib/server/trip-id";

export type TripWorkspaceData = {
  dateRange: string;
  destination: string;
  error: string | null;
  id: string;
  name: string;
  status: string;
};

type TripRow = {
  destination: string | null;
  end_date: string | null;
  id: string;
  name: string;
  start_date: string | null;
  status: string | null;
};

export async function loadTripWorkspaceData(tripId: string): Promise<TripWorkspaceData> {
  if (isDemoTripId(tripId)) {
    return {
      dateRange: "Jun 11 - Jun 17",
      destination: "Barcelona, Spain",
      error: null,
      id: tripId,
      name: "Barcelona Work Trip",
      status: "Demo"
    };
  }

  if (!isUuid(tripId)) {
    return emptyTripWorkspaceData(tripId, "Invalid trip id.");
  }

  const auth = await authorizeDashboardApi();

  if (!auth) {
    return emptyTripWorkspaceData(tripId, "Sign in to load this trip.");
  }

  const { data, error } = await auth.supabase
    .from("trips")
    .select("id,name,destination,start_date,end_date,status")
    .eq("id", tripId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) {
    return emptyTripWorkspaceData(tripId, "Could not load trip from Supabase.");
  }

  if (!data) {
    return emptyTripWorkspaceData(tripId, "Trip not found.");
  }

  return mapTrip(data as TripRow);
}

function mapTrip(row: TripRow): TripWorkspaceData {
  return {
    dateRange: formatDateRange(row.start_date, row.end_date),
    destination: row.destination || "No destination set",
    error: null,
    id: row.id,
    name: row.name,
    status: row.status || "Planning"
  };
}

function emptyTripWorkspaceData(tripId: string, error: string): TripWorkspaceData {
  return {
    dateRange: "Dates unavailable",
    destination: "Destination unavailable",
    error,
    id: tripId,
    name: "Trip unavailable",
    status: "Unavailable"
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
