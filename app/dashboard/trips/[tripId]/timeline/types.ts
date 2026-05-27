import type { TripSegmentType } from "@/lib/domain/trip";
import type { TimelineStatus } from "@/lib/ui/timeline";

export type TimelineItemView = {
  actionLabel: string;
  confirmation: string;
  costLabel: string;
  details: string[];
  id: string;
  kind: TripSegmentType;
  lat: number | null;
  lng: number | null;
  location: string;
  meta: string;
  notes: string | null;
  status: TimelineStatus;
  startAt: string | null;
  endAt: string | null;
  timeRange: string;
  title: string;
  typeLabel: string;
};

export type TimelineDayView = {
  date: string;
  dayNumber: string;
  id: string;
  items: TimelineItemView[];
  label: string;
  summary: string;
};

export type TimelineDayTabView = {
  count: number;
  date: string;
  href: string;
  label: string;
};

export type TripTimelineStats = {
  alerts: number;
  mappedStops: number;
  readyItems: number;
  totalItems: number;
};

export type TripTimelineData = {
  dayTabs: TimelineDayTabView[];
  days: TimelineDayView[];
  description: string;
  error: string | null;
  firstFlight: TimelineItemView | null;
  stats: TripTimelineStats;
  title: string;
  tripId: string;
};
