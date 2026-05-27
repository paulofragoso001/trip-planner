export type BudgetCategoryView = {
  amountLabel: string;
  category: string;
  id: string;
  label: string;
};

export type BudgetAlertView = {
  id: string;
  message: string;
  tone: "good" | "warning" | "danger" | "neutral";
};

export type TripBudgetData = {
  alerts: BudgetAlertView[];
  categories: BudgetCategoryView[];
  error: string | null;
  plannedLabel: string;
  actualLabel: string;
  remainingLabel: string;
  tripId: string;
};
