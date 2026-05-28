import "server-only";

import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import {
  TRIP_TRAVEL_STYLE_LABELS,
  normalizeTravelStyle,
  type TripTravelStyle
} from "@/lib/trips";

export type TripListItemView = {
  dateRange: string;
  destination: string;
  href: string;
  id: string;
  name: string;
  endDate: string | null;
  startDate: string | null;
  status: string;
  travelStyle: TripTravelStyle;
  travelStyleLabel: string;
};

export type TripsData = {
  error: string | null;
  trips: TripListItemView[];
};

type TripRow = {
  destination: string | null;
  end_date: string | null;
  id: string;
  name: string;
  start_date: string | null;
  status: string | null;
  travel_style: string | null;
};

export async function loadTripsData(): Promise<TripsData> {
  const auth = await authorizeDashboardApi();

  if (!auth) {
    return {
      error: "Sign in to load your trips.",
      trips: []
    };
  }

  const { data, error } = await loadTripRows(auth.supabase, auth.userId);

  if (error) {
    console.error(
      JSON.stringify({
        area: "trips",
        event: "trips_load_failed",
        message: error.message,
        userId: auth.userId
      })
    );

    return {
      error: "Could not load trips from Supabase.",
      trips: []
    };
  }

  return {
    error: null,
    trips: ((data || []) as TripRow[]).map(mapTrip)
  };
}

async function loadTripRows(supabase: any, userId: string) {
  const withTravelStyle = await supabase
    .from("trips")
    .select("id,name,destination,start_date,end_date,status,travel_style")
    .eq("user_id", userId)
    .order("start_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!withTravelStyle.error || !isMissingTravelStyleColumn(withTravelStyle.error.message)) {
    return withTravelStyle;
  }

  console.warn(
    JSON.stringify({
      area: "trips",
      event: "trips_load_schema_fallback",
      message: withTravelStyle.error.message,
      userId
    })
  );

  return supabase
    .from("trips")
    .select("id,name,destination,start_date,end_date,status")
    .eq("user_id", userId)
    .order("start_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
}

function isMissingTravelStyleColumn(message: string) {
  return /travel_style/i.test(message) && /column|schema cache|could not find/i.test(message);
}

function mapTrip(row: TripRow): TripListItemView {
  const travelStyle = normalizeTravelStyle(row.travel_style);

  return {
    dateRange: formatDateRange(row.start_date, row.end_date),
    destination: row.destination || "No destination set",
    href: `/dashboard/trips/${row.id}`,
    id: row.id,
    name: row.name,
    endDate: row.end_date,
    startDate: row.start_date,
    status: row.status || "Planning",
    travelStyle,
    travelStyleLabel: TRIP_TRAVEL_STYLE_LABELS[travelStyle]
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
