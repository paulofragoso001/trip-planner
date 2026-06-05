import type { TripSegmentStatus, TripSegmentType } from "@/lib/domain/trip";

export type TimelineStatus = Extract<
  TripSegmentStatus,
  "confirmed" | "synced" | "watch"
>;

export function dayIdFromDate(value: string) {
  return `day-${value.toLowerCase().replaceAll(" ", "-")}`;
}

export function segmentTypeLabel(type: TripSegmentType) {
  switch (type) {
    case "activity":
      return "Activity";
    case "expense":
      return "Expense";
    case "flight":
      return "Flight";
    case "hotel":
      return "Hotel";
    case "meeting":
      return "Meeting";
    case "place":
      return "Place";
    case "restaurant":
      return "Restaurant";
    case "transport":
      return "Transport";
    default:
      return exhaustive(type);
  }
}

export function timelineStatusLabel(status: TimelineStatus) {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "synced":
      return "Synced";
    case "watch":
      return "Watch";
    default:
      return exhaustive(status);
  }
}

export function timelineStatusClass(status: TimelineStatus) {
  const base = "rounded-full px-2.5 py-1 text-xs font-bold";

  switch (status) {
    case "confirmed":
      return `${base} bg-emerald-50 text-emerald-700`;
    case "synced":
      return `${base} bg-blue-50 text-blue-700`;
    case "watch":
      return `${base} bg-amber-50 text-amber-700`;
    default:
      return exhaustive(status);
  }
}

function exhaustive(value: never): never {
  throw new Error(`Unhandled timeline value: ${String(value)}`);
}
