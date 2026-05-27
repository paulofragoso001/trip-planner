import "server-only";

import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { isDemoTripId, isUuid } from "@/lib/server/trip-id";

export type TripOverviewData = {
  actualLabel: string;
  destination: string;
  error: string | null;
  notes: string | null;
  plannedLabel: string;
  remainingLabel: string;
  segmentCount: number;
  status: string;
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
  currency: string | null;
  record_type: string | null;
};

export async function loadTripOverviewData(tripId: string): Promise<TripOverviewData> {
  if (isDemoTripId(tripId)) {
    return {
      actualLabel: "$3,870",
      destination: "Barcelona, Spain",
      error: null,
      notes: "Demo workspace",
      plannedLabel: "$4,200",
      remainingLabel: "$330",
      segmentCount: 5,
      status: "On track",
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

  const [tripResult, segmentResult, budgetResult] = await Promise.all([
    auth.supabase
      .from("trips")
      .select("name,destination,status,budget,notes")
      .eq("id", tripId)
      .eq("user_id", auth.userId)
      .maybeSingle(),
    auth.supabase
      .from("trip_segments")
      .select("id", { count: "exact", head: true })
      .eq("trip_id", tripId)
      .eq("user_id", auth.userId),
    auth.supabase
      .from("budget_records")
      .select("amount,currency,record_type")
      .eq("trip_id", tripId)
      .eq("user_id", auth.userId)
  ]);

  if (tripResult.error || segmentResult.error || budgetResult.error) {
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

  return {
    actualLabel: formatMoney(actual, currency),
    destination: trip.destination || "No destination set",
    error: null,
    notes: trip.notes,
    plannedLabel: formatMoney(planned, currency),
    remainingLabel: formatMoney(planned - actual, currency),
    segmentCount: segmentResult.count || 0,
    status: trip.status || "Planning",
    title: trip.name,
    tripId
  };
}

function emptyOverviewData(tripId: string, error: string): TripOverviewData {
  return {
    actualLabel: "$0",
    destination: "Destination unavailable",
    error,
    notes: null,
    plannedLabel: "$0",
    remainingLabel: "$0",
    segmentCount: 0,
    status: "Unavailable",
    title: "Trip unavailable",
    tripId
  };
}

function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}
