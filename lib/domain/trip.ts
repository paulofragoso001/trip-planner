import type { TripSegmentRouteMetadata } from "@/lib/trip-segment-route";

export type TripSegmentType =
  | "activity"
  | "expense"
  | "flight"
  | "hotel"
  | "meeting"
  | "place"
  | "restaurant"
  | "transport";

export type TripSegmentStatus = "confirmed" | "pending" | "synced" | "watch";

export type TripSegment = {
  actionLabel: string;
  confirmation: string;
  costLabel: string;
  details: string[];
  endAt: string | null;
  id: string;
  imageAlt?: string | null;
  imageAttribution?: string | null;
  imageUrl?: string | null;
  insertedAt?: string | null;
  hasEndTime?: boolean;
  hasStartTime?: boolean;
  lat?: number | null;
  lng?: number | null;
  location: string;
  meta: string;
  notes?: string | null;
  position?: number | null;
  route?: TripSegmentRouteMetadata | null;
  startAt: string | null;
  status: TripSegmentStatus;
  title: string;
  tripId: string;
  type: TripSegmentType;
};
