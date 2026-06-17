export type BudgetCurrencyTotal = {
  currency: string;
  label: string;
};

export type BudgetCategoryView = {
  amountLabel: string;
  category: string;
  currencyTotals: BudgetCurrencyTotal[];
  id: string;
  label: string;
  records: Array<{
    amountLabel: string;
    id: string;
    label: string;
  }>;
};

export type BudgetAlertView = {
  id: string;
  message: string;
  tone: "good" | "warning" | "danger" | "neutral";
};

export type TripBudgetData = {
  alerts: BudgetAlertView[];
  categories: BudgetCategoryView[];
  currencyTotals: BudgetCurrencyTotal[];
  destination: string;
  error: string | null;
  latestRecords: Array<{
    amountLabel: string;
    category: string;
    id: string;
    label: string;
    recordType: string;
  }>;
  plannedLabel: string;
  actualLabel: string;
  remainingLabel: string;
  title: string;
  tripId: string;
};
