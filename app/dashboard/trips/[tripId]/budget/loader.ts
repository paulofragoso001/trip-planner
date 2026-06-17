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
    amountLabel: "$42.00",
    category: "bar-party",
    currencyTotals: [{ currency: "USD", label: "$42.00" }],
    id: "demo-bar-party",
    label: "Bar & Party",
    records: [{ amountLabel: "$42.00", id: "demo-record-magic-hour", label: "Magic Hour" }]
  },
  {
    amountLabel: "$1,075.00",
    category: "flight",
    currencyTotals: [{ currency: "USD", label: "$1,075.00" }],
    id: "demo-flight",
    label: "Flight",
    records: [{ amountLabel: "$1,075.00", id: "demo-record-flight", label: "LAX → JFK" }]
  },
  {
    amountLabel: "$2,500.00",
    category: "lodging",
    currencyTotals: [{ currency: "USD", label: "$2,500.00" }],
    id: "demo-lodging",
    label: "Lodging",
    records: [{ amountLabel: "$2,500.00", id: "demo-record-hotel", label: "Aman New York" }]
  },
  {
    amountLabel: "$34.00",
    category: "restaurant",
    currencyTotals: [{ currency: "USD", label: "$34.00" }],
    id: "demo-restaurant",
    label: "Restaurant",
    records: [{ amountLabel: "$34.00", id: "demo-record-potluck", label: "Potluck Club" }]
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
  const currency = normalizeCurrency(rows[0]?.currency);
  const currencyTotals = buildCurrencyTotals(actualRows, currency);
  const categories = groupCategories(actualRows, currency);

  return {
    actualLabel: formatCurrencyTotals(currencyTotals),
    alerts: buildAlerts(plannedBudget, remaining, actualTotal, categories),
    categories,
    currencyTotals,
    destination: trip?.destination || "Trip",
    error: null,
    latestRecords: actualRows.slice(-5).reverse().map((row) => ({
      amountLabel: formatMoney(readAmount(row), normalizeCurrency(row.currency || currency)),
      category: normalizeBudgetCategory(row.category),
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
    actualLabel: "$0.00",
    alerts: [
      {
        id: "budget-error",
        message: error,
        tone: "warning"
      }
    ],
    categories: [],
    currencyTotals: [{ currency: "USD", label: "$0.00" }],
    destination: "Trip",
    error,
    latestRecords: [],
    plannedLabel: "$0.00",
    remainingLabel: "$0.00",
    title: "My Spending",
    tripId
  };
}

function groupCategories(rows: BudgetRecordRow[], currency: string): BudgetCategoryView[] {
  const totals = new Map<
    string,
    {
      currencyTotals: Map<string, number>;
      label: string;
      records: BudgetCategoryView["records"];
    }
  >();

  for (const row of rows) {
    const category = normalizeBudgetCategory(row.category);
    const rowCurrency = normalizeCurrency(row.currency || currency);
    const existing = totals.get(category);
    const currencyTotals = new Map(existing?.currencyTotals || []);
    currencyTotals.set(rowCurrency, (currencyTotals.get(rowCurrency) || 0) + readAmount(row));
    totals.set(category, {
      currencyTotals,
      label: existing?.label || labelForCategory(category, null),
      records: [
        ...(existing?.records || []),
        {
          amountLabel: formatMoney(readAmount(row), rowCurrency),
          id: row.id,
          label: row.label || labelForCategory(category, null)
        }
      ]
    });
  }

  return Array.from(totals.entries()).map(([category, value]) => ({
    amountLabel: formatCurrencyTotals(mapCurrencyTotals(value.currencyTotals)),
    category,
    currencyTotals: mapCurrencyTotals(value.currencyTotals),
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
    actualLabel: "$3,651.00",
    alerts: [
      { id: "demo-good", message: "On track: remaining budget is $549.00.", tone: "good" },
      {
        id: "demo-warning",
        message: "Restaurant spending is ready for review.",
        tone: "warning"
      }
    ],
    categories: demoCategories,
    currencyTotals: [{ currency: "USD", label: "$3,651.00" }],
    destination: "Barcelona, Spain",
    error: null,
    latestRecords: [
      {
        amountLabel: "$1,075.00",
        category: "flight",
        id: "demo-record-flight",
        label: "LAX → JFK",
        recordType: "actual"
      },
      {
        amountLabel: "$42.00",
        category: "bar-party",
        id: "demo-record-magic-hour",
        label: "Magic Hour",
        recordType: "actual"
      },
      {
        amountLabel: "$2,500.00",
        category: "lodging",
        id: "demo-record-hotel",
        label: "Aman New York",
        recordType: "actual"
      }
    ],
    plannedLabel: "$4,200.00",
    remainingLabel: "$549.00",
    title: "Barcelona Work Trip",
    tripId
  };
}

function labelForCategory(category: string, fallback: string | null) {
  if (fallback) {
    return fallback;
  }

  switch (normalizeBudgetCategory(category)) {
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

function readAmount(row: BudgetRecordRow) {
  return Number(row.amount || 0);
}

function buildCurrencyTotals(rows: BudgetRecordRow[], fallbackCurrency: string) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const currency = normalizeCurrency(row.currency || fallbackCurrency);
    totals.set(currency, (totals.get(currency) || 0) + readAmount(row));
  }

  return mapCurrencyTotals(totals);
}

function mapCurrencyTotals(totals: Map<string, number>) {
  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => ({
      currency,
      label: formatMoney(amount, currency)
    }));
}

function formatCurrencyTotals(totals: Array<{ label: string }>) {
  return totals.length ? totals.map((total) => total.label).join(" + ") : "$0.00";
}

function normalizeCurrency(currency: string | null | undefined) {
  return String(currency || "USD").trim().toUpperCase() || "USD";
}

function normalizeBudgetCategory(category: string | null | undefined) {
  const normalized = String(category || "misc").toLowerCase();
  if (/flight|air|airport/.test(normalized)) return "flight";
  if (/lodging|hotel|stay|room/.test(normalized)) return "lodging";
  if (/restaurant|food|dining|dinner|lunch|breakfast|meal|potluck/.test(normalized)) return "restaurant";
  if (/bar|nightlife|party|club|drink|cocktail/.test(normalized)) return "bar-party";
  if (/ground|transport|car|train|rail|road|taxi|uber|transfer|bus/.test(normalized)) return "transport";
  if (/activity|place|attraction|museum|tour|event|meeting|park/.test(normalized)) return "activity";
  return "other";
}

function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);
}
