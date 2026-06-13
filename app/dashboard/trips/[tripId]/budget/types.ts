export type BudgetCategoryView = {
  amountLabel: string;
  category: string;
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
