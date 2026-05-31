export type TripSegmentType = "dinner" | "expense" | "flight" | "hotel" | "meeting";

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
  lat?: number | null;
  lng?: number | null;
  location: string;
  meta: string;
  notes?: string | null;
  startAt: string | null;
  status: TripSegmentStatus;
  title: string;
  tripId: string;
  type: TripSegmentType;
};
