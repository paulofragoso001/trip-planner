export type PlanType =
  | "flight"
  | "hotel"
  | "activity"
  | "transport"
  | "meeting"
  | "note";

export type TripPlan = {
  id: string;
  type: PlanType;
  title: string;
  time?: string;
  endTime?: string;
  location?: string;
  notes?: string;
  lat?: number;
  lng?: number;
  dayLabel: string;
};

export type GroupedPlans = Record<string, TripPlan[]>;

export type DailyWeather = {
  dayLabel: string;
  summary: string;
  high?: number;
  low?: number;
};

export type DirectionLeg = {
  id: string;
  fromPlanId: string;
  toPlanId: string;
  summary: string;
  distance?: string;
  duration?: string;
  mapNote?: string;
};

export type TripPreviewData = {
  title: string;
  dateRange?: string;
  destination?: string;
  plans: TripPlan[];
  weather?: DailyWeather[];
  directions?: DirectionLeg[];
};
