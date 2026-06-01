import type { TripSegmentType } from "@/lib/domain/trip";
import type { TimelineStatus } from "@/lib/ui/timeline";

export type TimelineItemView = {
  actionLabel: string;
  bookingUrl: string | null;
  confirmation: string;
  confirmationCode: string | null;
  costLabel: string;
  details: string[];
  displayDate: string;
  durationLabel: string | null;
  id: string;
  imageAlt: string | null;
  imageAttribution: string | null;
  imageUrl: string | null;
  hasEndTime: boolean;
  hasStartTime: boolean;
  kind: TripSegmentType;
  lat: number | null;
  lng: number | null;
  location: string;
  locationStatus: string;
  meta: string;
  notes: string | null;
  provider: string | null;
  status: TimelineStatus;
  startAt: string | null;
  endAt: string | null;
  timeRange: string;
  timeZoneLabel: string;
  title: string;
  typeLabel: string;
};

export type TimelineDayView = {
  date: string;
  dateIso: string | null;
  dayNumber: string;
  id: string;
  items: TimelineItemView[];
  label: string;
  routeSummary: {
    estimatedDurationMinutes: number;
    provider: "estimate" | "google_distance_matrix";
    totalDistanceMeters: number;
    warnings: Array<{
      code: "long_distance" | "too_many_stops" | "transit_heavy";
      message: string;
    }>;
  };
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
