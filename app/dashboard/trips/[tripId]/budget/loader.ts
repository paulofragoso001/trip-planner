import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { isDemoTripId, isUuid } from "@/lib/server/trip-id";
import type { BudgetAlertView, BudgetCategoryView, TripBudgetData } from "./types";

type BudgetRecordRow = {
  amount: number | string | null;
  category: string | null;
  created_at?: string | null;
  currency: string | null;
  id: string;
  label: string | null;
  record_type: "actual" | "planned" | string | null;
};

type BudgetTripRow = {
  budget?: number | string | null;
  destination?: string | null;
  name?: string | null;
};

const demoCategories: BudgetCategoryView[] = [
  {
    amountLabel: "$1,120",
    category: "flights",
    id: "demo-flights",
    label: "Flights",
    records: [{ amountLabel: "$1,120", id: "demo-record-flight", label: "MIA to BCN" }]
  },
  {
    amountLabel: "$1,860",
    category: "lodging",
    id: "demo-lodging",
    label: "Lodging",
    records: [{ amountLabel: "$1,860", id: "demo-record-hotel", label: "Hotel Arts" }]
  },
  {
    amountLabel: "$520",
    category: "food",
    id: "demo-food",
    label: "Food",
    records: [{ amountLabel: "$420", id: "demo-record-dinner", label: "Team dinner" }]
  },
  {
    amountLabel: "$220",
    category: "ground",
    id: "demo-ground",
    label: "Ground transport",
    records: [{ amountLabel: "$220", id: "demo-record-ground", label: "Airport transfer" }]
  }
];

export async function loadTripBudgetData(tripId: string): Promise<TripBudgetData> {
  if (isDemoTripId(tripId)) {
    return demoBudgetData(tripId);
  }

  if (!isUuid(tripId)) {
    return emptyBudgetData(tripId, "Invalid trip id.");
  }

  const auth = await authorizeDashboardApi();

  if (!auth) {
    return emptyBudgetData(tripId, "Sign in to load trip expenses.");
  }

  const [{ data: trip }, { data: records, error }] = await Promise.all([
    auth.supabase
      .from("trips")
      .select("budget,name,destination")
      .eq("id", tripId)
      .eq("user_id", auth.userId)
      .maybeSingle(),
    auth.supabase
      .from("budget_records")
      .select("id,category,label,amount,currency,record_type")
      .eq("trip_id", tripId)
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: true })
  ]);

  if (error) {
    return emptyBudgetData(tripId, "Could not load trip expenses.");
  }

  return mapRowsToBudgetData(
    tripId,
    (trip || null) as BudgetTripRow | null,
    (records || []) as BudgetRecordRow[]
  );
}

function mapRowsToBudgetData(
  tripId: string,
  trip: BudgetTripRow | null,
  rows: BudgetRecordRow[]
): TripBudgetData {
  const plannedBudget = Number(trip?.budget || 0);
  const actualRows = rows.filter((row) => row.record_type !== "planned");
  const actualTotal = actualRows.reduce((total, row) => total + readAmount(row), 0);
  const remaining = plannedBudget - actualTotal;
  const currency = rows[0]?.currency || "USD";
  const categories = groupCategories(actualRows, currency);

  return {
    actualLabel: formatMoney(actualTotal, currency),
    alerts: buildAlerts(plannedBudget, remaining, actualTotal, categories),
    categories,
    destination: trip?.destination || "Trip",
    error: null,
    latestRecords: actualRows.slice(-5).reverse().map((row) => ({
      amountLabel: formatMoney(readAmount(row), row.currency || currency),
      category: row.category || "misc",
      id: row.id,
      label: row.label || labelForCategory(row.category || "misc", null),
      recordType: row.record_type || "actual"
    })),
    plannedLabel: formatMoney(plannedBudget, currency),
    remainingLabel: formatMoney(remaining, currency),
    title: trip?.name || "My Spending",
    tripId
  };
}

function emptyBudgetData(tripId: string, error: string): TripBudgetData {
  return {
    actualLabel: "$0",
    alerts: [
      {
        id: "budget-error",
        message: error,
        tone: "warning"
      }
    ],
    categories: [],
    destination: "Trip",
    error,
    latestRecords: [],
    plannedLabel: "$0",
    remainingLabel: "$0",
    title: "My Spending",
    tripId
  };
}

function groupCategories(rows: BudgetRecordRow[], currency: string): BudgetCategoryView[] {
  const totals = new Map<
    string,
    {
      amount: number;
      label: string;
      records: BudgetCategoryView["records"];
    }
  >();

  for (const row of rows) {
    const category = row.category || "misc";
    const existing = totals.get(category);
    totals.set(category, {
      amount: (existing?.amount || 0) + readAmount(row),
      label: existing?.label || labelForCategory(category, null),
      records: [
        ...(existing?.records || []),
        {
          amountLabel: formatMoney(readAmount(row), row.currency || currency),
          id: row.id,
          label: row.label || labelForCategory(category, null)
        }
      ]
    });
  }

  return Array.from(totals.entries()).map(([category, value]) => ({
    amountLabel: formatMoney(value.amount, currency),
    category,
    id: category,
    label: value.label,
    records: value.records
  }));
}

function buildAlerts(
  planned: number,
  remaining: number,
  actual: number,
  categories: BudgetCategoryView[]
): BudgetAlertView[] {
  if (planned <= 0) {
    return [
      {
        id: "no-budget",
        message: "Add a trip spending limit to track remaining spend.",
        tone: "neutral"
      }
    ];
  }

  const alerts: BudgetAlertView[] = [
    {
      id: remaining < 0 ? "over" : "remaining",
      message:
        remaining < 0
          ? `Over budget by ${formatMoney(Math.abs(remaining))}.`
          : `On track: remaining budget is ${formatMoney(remaining)}.`,
      tone: remaining < 0 ? "danger" : "good"
    }
  ];

  if (actual / planned >= 0.9 && remaining >= 0) {
    alerts.push({
      id: "near-limit",
      message: "Spending is close to the trip limit.",
      tone: "warning"
    });
  }

  if (categories.length === 0) {
    alerts.push({
      id: "no-records",
      message: "No expense records are linked to this trip yet.",
      tone: "neutral"
    });
  }

  return alerts;
}

function demoBudgetData(tripId: string): TripBudgetData {
  return {
    actualLabel: "$3,870",
    alerts: [
      { id: "demo-good", message: "On track: remaining budget is $330.", tone: "good" },
      {
        id: "demo-warning",
        message: "Category warning: food is close to limit.",
        tone: "warning"
      }
    ],
    categories: demoCategories,
    destination: "Barcelona, Spain",
    error: null,
    latestRecords: [
      {
        amountLabel: "$1,120",
        category: "flights",
        id: "demo-record-flight",
        label: "MIA to BCN",
        recordType: "actual"
      },
      {
        amountLabel: "$420",
        category: "food",
        id: "demo-record-dinner",
        label: "Team dinner",
        recordType: "actual"
      },
      {
        amountLabel: "$1,860",
        category: "lodging",
        id: "demo-record-hotel",
        label: "Hotel Arts",
        recordType: "actual"
      }
    ],
    plannedLabel: "$4,200",
    remainingLabel: "$330",
    title: "Barcelona Work Trip",
    tripId
  };
}

function labelForCategory(category: string, fallback: string | null) {
  if (fallback) {
    return fallback;
  }

  return category
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function readAmount(row: BudgetRecordRow) {
  return Number(row.amount || 0);
}

function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}
