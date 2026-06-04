import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bed,
  Car,
  CloudSun,
  Flag,
  FileText,
  Landmark,
  Plane,
  Plus,
  StickyNote,
  Train,
  Utensils
} from "lucide-react";
import type { ReactNode } from "react";
import type {
  TimelineItemView,
  TripTimelineData
} from "@/app/dashboard/trips/[tripId]/timeline/types";
import { AsyncActionButton } from "@/components/dashboard/async-action-button";
import { PlacePhoto } from "@/components/place-photo";
import { CalendarSyncPanel } from "@/components/trip/calendar-sync-panel";
import { GeneratePlanButton } from "@/components/trip/generate-plan-button";
import { ItineraryCardActions } from "@/components/trip/itinerary-card-actions";
import { TripSegmentForm } from "@/components/trip/trip-segment-form";
import { EmptyState } from "@/components/trip-ui";
import { waylineCopy } from "@/lib/copy/wayline-copy";

type TripTimelinePageProps = TripTimelineData;

export default function TripTimelinePage({
  days,
  error,
  firstFlight,
  stats,
  tripId
}: TripTimelinePageProps) {
  const items = days.flatMap((day) => day.items);
  const timelineItemIds = items.map((item) => item.id);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0">
        {error ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {error}
          </p>
        ) : null}

        {days.length ? (
          <div className="grid gap-5">
            <ItineraryDateStrip days={days} />

            {days.map((day) => (
              <section className="scroll-mt-24" id={dayAnchorId(day)} key={day.id}>
                <div className="sticky top-14 z-10 -mx-3 border-y border-slate-200 bg-slate-100/95 px-3 py-2.5 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:bg-white/78 sm:px-4 sm:shadow-sm sm:ring-1 sm:ring-white/70">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="min-w-0 truncate text-xs font-black uppercase tracking-[0.2em] text-slate-700 sm:text-sm">
                      {day.date}
                    </h3>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-200">
                      {day.items.length} place{day.items.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {day.items.length} place{day.items.length === 1 ? "" : "s"} planned
                  </p>
                </div>

                <div className="mt-4 grid gap-0">
                  {day.items.map((item, index) => (
                    <ItineraryRow
                      isLast={index === day.items.length - 1}
                      item={item}
                      key={item.id}
                      tripId={tripId}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState
              action={
                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-black text-white"
                    href="/dashboard/imports"
                  >
                    Plan with AI
                  </Link>
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-4 text-sm font-black text-slate-800 ring-1 ring-slate-200"
                    href="#new-plan"
                  >
                    Add trip detail
                  </Link>
                </div>
              }
              description="Keep reservations, notes, screenshots, and travel details together."
              title="No itinerary yet."
            />
          </div>
        )}
      </section>

      <aside className="grid content-start gap-4 xl:sticky xl:top-24 xl:self-start">
        <ItineraryActions firstFlight={firstFlight} timelineItemIds={timelineItemIds} tripId={tripId} />
        <ItinerarySummary stats={stats} />
        <CalendarSyncPanel tripId={tripId} />
      </aside>

      <Link
        aria-label="Add itinerary item"
        className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-blue-600 text-white shadow-2xl ring-4 ring-white transition hover:bg-blue-700 focus:outline-none focus:ring-blue-200 md:hidden"
        href="#new-plan"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </Link>
    </div>
  );
}

function ItineraryDateStrip({ days }: { days: TripTimelineData["days"] }) {
  const datedDays = days.filter((day) => day.dateIso);

  if (!datedDays.length) {
    return null;
  }

  return (
    <nav
      aria-label="Itinerary dates"
      className="overflow-x-auto pb-1"
      data-testid="itinerary-date-strip"
    >
      <div className="flex min-w-0 gap-2">
        {datedDays.map((day, index) => (
          <a
            aria-label={`Jump to ${day.date}`}
            className={[
              "inline-flex min-h-14 shrink-0 items-center gap-3 rounded-2xl px-3 text-left ring-1 transition focus:outline-none focus:ring-4 focus:ring-blue-100",
              index === 0
                ? "bg-slate-950 text-white ring-slate-950"
                : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
            ].join(" ")}
            href={`#${dayAnchorId(day)}`}
            key={day.id}
          >
            <span className="grid gap-0.5">
              <span className={index === 0 ? "text-xs font-black uppercase tracking-[0.16em] text-white/62" : "text-xs font-black uppercase tracking-[0.16em] text-slate-400"}>
                {day.label}
              </span>
              <span className="text-lg font-black leading-none">{day.dayNumber}</span>
            </span>
            <span className="flex max-w-16 flex-wrap gap-1" aria-hidden="true">
              {categoryDotsForDay(day.items).map((className, dotIndex) => (
                <span className={`h-1.5 w-1.5 rounded-full ${className}`} key={`${day.id}-${dotIndex}`} />
              ))}
            </span>
            <span className={index === 0 ? "rounded-full bg-white/12 px-2 py-1 text-[0.65rem] font-black text-white/78" : "rounded-full bg-slate-100 px-2 py-1 text-[0.65rem] font-black text-slate-600"}>
              {day.items.length}
            </span>
          </a>
        ))}
      </div>
    </nav>
  );
}

function dayAnchorId(day: TripTimelineData["days"][number]) {
  return day.dateIso ? `day-${day.dateIso}` : day.id;
}

function ItineraryRow({
  isLast,
  item,
  tripId
}: {
  isLast: boolean;
  item: TimelineItemView;
  tripId: string;
}) {
  const display = getSegmentDisplay(item);
  const status = getItemStatus(item);

  return (
    <article
      className="grid grid-cols-[68px_34px_minmax(0,1fr)] gap-2 sm:grid-cols-[92px_44px_minmax(0,1fr)] sm:gap-3"
      id={item.id}
    >
      <div className="pt-5 text-right">
        <p className="text-sm font-black text-slate-950">{formatPrimaryTime(item)}</p>
        {formatSecondaryTimeLabel(item) ? (
          <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-500">
            {formatSecondaryTimeLabel(item)}
          </p>
        ) : null}
      </div>

      <div className="relative flex justify-center">
        {!isLast ? <span className={`absolute bottom-0 top-0 w-0.5 ${display.lineClass}`} /> : null}
        <span
          aria-label={`${display.label} icon`}
          className={`relative mt-5 grid h-9 w-9 place-items-center rounded-full border-4 border-white shadow-sm ${display.iconClass}`}
          data-testid="itinerary-category-icon"
        >
          {display.icon}
        </span>
      </div>

      <div className="min-w-0 pb-4 pt-3">
        {item.kind === "flight" ? (
          <FlightBoardingPassCard item={item} status={status} tripId={tripId} />
        ) : item.kind === "hotel" ? (
          <HotelPassCard item={item} status={status} tripId={tripId} />
        ) : item.kind === "dinner" ? (
          <RestaurantReservationCard item={item} status={status} tripId={tripId} />
        ) : (
        <div className="rounded-[1.35rem] border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-white transition hover:border-slate-300 hover:shadow-md sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                {display.label}
              </p>
            </div>
            <span className={status.className}>{status.label}</span>
          </div>

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_80px] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_128px]">
            <div className="min-w-0">
              <h4 className="break-words text-lg font-black leading-tight text-slate-950 sm:text-xl">
                {item.title}
              </h4>
              <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                {item.location}
              </p>
              <ItemSource item={item} />
              {item.confirmationCode || item.durationLabel ? (
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                  {item.confirmationCode ? (
                    <span>Confirmation {item.confirmationCode}</span>
                  ) : null}
                  {item.durationLabel ? <span>{item.durationLabel}</span> : null}
                </div>
              ) : null}
            </div>

            {shouldShowPlacePhoto(item) ? (
              <PlacePhoto
                alt={item.imageAlt || `Photo of ${item.title}`}
                attribution={item.imageAttribution}
                className="h-20 w-20 rounded-2xl sm:h-32 sm:w-32"
                fallbackLabel={item.typeLabel || "Place"}
                src={item.imageUrl}
              />
            ) : null}
          </div>

          <StateCopy item={item} />

          <ItineraryCardActions item={item} tripId={tripId} />
        </div>
        )}
      </div>
    </article>
  );
}

function ItemSource({ item }: { item: TimelineItemView }) {
  const source = item.provider || item.meta;
  if (!source) return null;

  return (
    <p className="mt-1 truncate text-xs font-black uppercase tracking-[0.12em] text-slate-400">
      {source}
    </p>
  );
}

function RestaurantReservationCard({
  item,
  status,
  tripId
}: {
  item: TimelineItemView;
  status: { className: string; label: string };
  tripId: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-white transition hover:border-slate-300 hover:shadow-md sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          Restaurant
        </p>
        <span className={status.className}>{status.label}</span>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_80px] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_132px]">
        <div className="min-w-0">
          <h4 className="break-words text-xl font-black leading-tight text-slate-950 sm:text-2xl">
            {item.title}
          </h4>
          <p className="mt-2 break-words text-sm leading-6 text-slate-600">
            {item.location}
          </p>

          <div className="mt-4 grid gap-1.5 text-sm font-semibold text-slate-600">
            <p>{restaurantMealLabel(item)} · {formatPrimaryTime(item)}</p>
            <p>
              Reservation:{" "}
              <span className="font-black text-slate-800">
                {item.confirmationCode || item.confirmation ? item.confirmationCode || item.confirmation : "optional"}
              </span>
            </p>
          </div>
        </div>

        <PlacePhoto
          alt={item.imageAlt || `Photo of ${item.title}`}
          attribution={item.imageAttribution}
          className="h-20 w-20 rounded-2xl sm:h-32 sm:w-32"
          fallbackLabel="Restaurant"
          src={item.imageUrl}
        />
      </div>

      <ItineraryCardActions item={item} tripId={tripId} />
    </div>
  );
}

function HotelPassCard({
  item,
  status,
  tripId
}: {
  item: TimelineItemView;
  status: { className: string; label: string };
  tripId: string;
}) {
  const hotelStatus = getHotelStatus(item, status);

  return (
    <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-sm ring-1 ring-white transition hover:border-slate-300 hover:shadow-md">
      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Hotel
          </p>
          <span className={hotelStatus.className}>{hotelStatus.label}</span>
        </div>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_80px] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_132px]">
          <div className="min-w-0">
            <h4 className="break-words text-xl font-black leading-tight text-slate-950 sm:text-2xl">
              {item.title}
            </h4>
            <p className="mt-2 break-words text-sm leading-6 text-slate-600">
              {item.location}
            </p>
          </div>
          <PlacePhoto
            alt={item.imageAlt || `Photo of ${item.title}`}
            attribution={item.imageAttribution}
            className="h-20 w-20 rounded-2xl sm:h-32 sm:w-32"
            fallbackLabel="Hotel"
            src={item.imageUrl}
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Check-in
            </p>
            <p className="mt-1 text-sm font-black text-slate-950">
              {formatHotelDateTime(item.startAt, item.hasStartTime)}
            </p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Check-out
            </p>
            <p className="mt-1 text-sm font-black text-slate-950">
              {formatHotelDateTime(item.endAt, item.hasEndTime)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative border-t border-dashed border-slate-200 px-3 py-3 sm:px-4">
        <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-[#f4f7fb]" aria-hidden="true" />
        <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-[#f4f7fb]" aria-hidden="true" />
        {item.confirmationCode || item.confirmation ? (
          <p className="text-xs font-semibold text-slate-500">
            Confirmation: <span className="font-black text-slate-800">{item.confirmationCode || item.confirmation}</span>
          </p>
        ) : null}
        <ItineraryCardActions item={item} tripId={tripId} />
      </div>
    </div>
  );
}

function FlightBoardingPassCard({
  item,
  status,
  tripId
}: {
  item: TimelineItemView;
  status: { className: string; label: string };
  tripId: string;
}) {
  const flight = getFlightDisplay(item);
  const flightStatus = getFlightStatus(item, status);

  return (
    <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-sm ring-1 ring-white transition hover:border-slate-300 hover:shadow-md">
      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Flight
          </p>
          <span className={flightStatus.className}>
            {flightStatus.label}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <div className="min-w-0">
            <p className="text-4xl font-black leading-none tracking-tight text-slate-950 sm:text-5xl">
              {flight.originCode}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-500">
              {flight.originCity}
            </p>
          </div>
          <div className="mb-4 flex min-w-14 items-center justify-center text-slate-400">
            <span className="h-px w-8 bg-slate-300" aria-hidden="true" />
            <ArrowRight className="mx-1 h-4 w-4" aria-hidden="true" />
            <span className="h-px w-8 bg-slate-300" aria-hidden="true" />
          </div>
          <div className="min-w-0 text-right">
            <p className="text-4xl font-black leading-none tracking-tight text-slate-950 sm:text-5xl">
              {flight.destinationCode}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-500">
              {flight.destinationCity}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
          <div>
            <p className="text-lg font-black text-slate-950">{flight.departureTime}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{flight.departureDate}</p>
          </div>
          <div className="pt-1 text-slate-300">
            <Plane className="h-5 w-5 rotate-90" aria-hidden="true" />
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-slate-950">{flight.arrivalTime}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{flight.arrivalDate}</p>
          </div>
        </div>
      </div>

      <div className="relative border-t border-dashed border-slate-200 px-3 py-3 sm:px-4">
        <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-[#f4f7fb]" aria-hidden="true" />
        <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-[#f4f7fb]" aria-hidden="true" />
        <p className="text-sm font-black text-slate-950">{flight.airlineLabel}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
          <BoardingPassMeta label="Terminal" value={flight.terminal} />
          <BoardingPassMeta label="Gate" value={flight.gate} />
          <BoardingPassMeta label="Seat" value={flight.seat} />
        </div>
        {flight.confirmation ? (
          <p className="mt-3 text-xs font-semibold text-slate-500">
            Confirmation: <span className="font-black text-slate-800">{flight.confirmation}</span>
          </p>
        ) : null}
        <ItineraryCardActions item={item} tripId={tripId} />
      </div>
    </div>
  );
}

function BoardingPassMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 font-black text-slate-800">{value}</p>
    </div>
  );
}

function getFlightStatus(
  item: TimelineItemView,
  fallback: { className: string; label: string }
) {
  const base = "inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-black";
  if (item.locationStatus === "provider_failed") {
    return { className: `${base} bg-amber-50 text-amber-700`, label: "Check status" };
  }
  if (item.startAt || item.confirmation || item.confirmationCode) {
    return { className: `${base} bg-emerald-50 text-emerald-700`, label: "Confirmed" };
  }
  return fallback;
}

function StateCopy({ item }: { item: TimelineItemView }) {
  if (item.locationStatus === "needs_activity_provider") {
    return (
      <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 sm:text-sm">
        Add a meeting point or provider before this appears on the map.
      </p>
    );
  }

  if (item.locationStatus !== "resolved") {
    return (
      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 sm:text-sm">
        Add or retry a location before this appears on the map.
      </p>
    );
  }

  return null;
}

function shouldShowPlacePhoto(item: TimelineItemView) {
  if (!item.imageUrl) return false;
  return !["flight", "hotel"].includes(item.kind);
}

function restaurantMealLabel(item: TimelineItemView) {
  const source = `${item.meta} ${item.typeLabel} ${item.title}`.toLowerCase();
  if (source.includes("breakfast")) return "Breakfast";
  if (source.includes("brunch")) return "Brunch";
  if (source.includes("lunch")) return "Lunch";
  if (source.includes("bar") || source.includes("drinks")) return "Drinks";
  return "Dinner";
}

function getHotelStatus(
  item: TimelineItemView,
  fallback: { className: string; label: string }
) {
  const base = "inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-black";
  if (item.locationStatus === "provider_failed") {
    return { className: `${base} bg-amber-50 text-amber-700`, label: "Check status" };
  }
  if (item.startAt || item.confirmation || item.confirmationCode) {
    return { className: `${base} bg-emerald-50 text-emerald-700`, label: "Confirmed" };
  }
  return fallback;
}

function formatHotelDateTime(value: string | null, hasExplicitTime: boolean) {
  if (!value) return "Not set";
  const date = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(value));
  if (!hasExplicitTime) return date;
  return `${date}, ${formatFlightTime(value)}`;
}

function getFlightDisplay(item: TimelineItemView) {
  const route = parseFlightRoute(item);
  const detail = parseFlightDetails(item.details || []);

  return {
    airlineLabel: item.meta || item.title,
    arrivalDate: formatFlightDate(item.endAt || item.startAt),
    arrivalTime: item.endAt && item.hasEndTime ? formatFlightTime(item.endAt) : "--",
    confirmation: item.confirmationCode || item.confirmation || "",
    departureDate: formatFlightDate(item.startAt),
    departureTime: item.startAt && item.hasStartTime ? formatFlightTime(item.startAt) : "--",
    destinationCity: route.destinationCity,
    destinationCode: route.destinationCode,
    gate: detail.gate,
    originCity: route.originCity,
    originCode: route.originCode,
    seat: detail.seat,
    terminal: detail.terminal
  };
}

function parseFlightRoute(item: TimelineItemView) {
  const titleCodes = (item.title || "").match(/\b([A-Z]{3})\b/g) || [];
  const [originCode = "—", destinationCode = "—"] = titleCodes;
  const locationParts = (item.location || "")
    .split(/\s+to\s+|→|-/i)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    destinationCity: simplifyAirportCity(locationParts[1] || destinationCode),
    destinationCode,
    originCity: simplifyAirportCity(locationParts[0] || originCode),
    originCode
  };
}

function simplifyAirportCity(value: string) {
  return value
    .replace(/\bInternational\b/gi, "")
    .replace(/\bAirport\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim() || "Airport";
}

function parseFlightDetails(details: string[] = []) {
  const safeDetails = Array.isArray(details) ? details : [];
  return {
    gate: readDetail(safeDetails, "Gate") || "—",
    seat: readDetail(safeDetails, "Seat") || "—",
    terminal: readDetail(safeDetails, "Terminal") || "—"
  };
}

function readDetail(details: string[] = [], label: string) {
  const match = details.find((detail) =>
    String(detail || "").toLowerCase().startsWith(label.toLowerCase())
  );
  if (!match) return "";
  return match.replace(new RegExp(`^${label}\\s*:?\\s*`, "i"), "").trim();
}

function formatFlightTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC"
  }).format(new Date(value));
}

function formatFlightDate(value: string | null) {
  if (!value) return "Date not set";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short"
  }).format(new Date(value));
}

function ItineraryActions({
  firstFlight,
  timelineItemIds,
  tripId
}: {
  firstFlight: TimelineItemView | null;
  timelineItemIds: string[];
  tripId: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
      <h3 className="text-base font-black">Add to itinerary</h3>
      <p className="mt-2 text-sm text-slate-600">Add a place, reservation, or activity idea.</p>
      <div className="mt-4 grid gap-3">
        <GeneratePlanButton context="timeline" tripId={tripId} />
        <AsyncActionButton
          body={{ orderedItemIds: timelineItemIds, tripId }}
          endpoint="/api/itinerary/reorder"
          successMessage="Itinerary order saved."
        >
          Reorder places
        </AsyncActionButton>
        {firstFlight ? (
          <AsyncActionButton
            body={{
              airline: null,
              arrivalAirport: null,
              departureAirport: null,
              estimatedDeparture: null,
              flightNumber: firstFlight.title,
              gate: null,
              itemId: firstFlight.id,
              scheduledDeparture: firstFlight.startAt,
              status: "scheduled",
              terminal: null,
              tripId
            }}
            endpoint="/api/itinerary/flight-status"
            successMessage="Flight status refreshed."
          >
            Refresh flights
          </AsyncActionButton>
        ) : null}
        <div id="new-plan">
          <TripSegmentForm buttonLabel="Add place" tripId={tripId} />
        </div>
      </div>
    </div>
  );
}

function ItinerarySummary({ stats }: { stats: TripTimelineData["stats"] }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
      <h3 className="text-base font-black">Trip summary</h3>
      <div className="mt-4 grid gap-3">
        <SummaryRow label="Places" value={String(stats.totalItems)} />
        <SummaryRow label="Mapped" value={`${stats.mappedStops} pins`} />
        <SummaryRow label="Needs location" value={String(stats.alerts)} />
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
      <span className="font-semibold text-slate-700">{label}</span>
      <strong className="text-slate-950">{value}</strong>
    </div>
  );
}

function getSegmentDisplay(item: TimelineItemView) {
  const category = `${item.kind} ${item.typeLabel} ${item.meta}`.toLowerCase();
  const needsLocation = item.locationStatus !== "resolved";
  const activityIdea = item.locationStatus === "needs_activity_provider";

  if (category.includes("flight")) return display("Flight", <Plane className="h-4 w-4" />, "bg-emerald-600 text-white", "bg-emerald-200");
  if (category.includes("hotel")) return display("Hotel", <Bed className="h-4 w-4" />, "bg-violet-600 text-white", "bg-violet-200");
  if (category.includes("restaurant") || category.includes("dinner")) return display("Restaurant", <Utensils className="h-4 w-4" />, "bg-rose-600 text-white", "bg-rose-200");
  if (category.includes("document") || category.includes("file")) return display("Document", <FileText className="h-4 w-4" />, "bg-indigo-600 text-white", "bg-indigo-200");
  if (category.includes("note")) return display("Note", <StickyNote className="h-4 w-4" />, "bg-slate-600 text-white", "bg-slate-200");
  if (category.includes("weather") || category.includes("timezone")) return display("Trip detail", <CloudSun className="h-4 w-4" />, "bg-sky-600 text-white", "bg-sky-200");
  if (category.includes("transport")) return display("Transportation", <Car className="h-4 w-4" />, "bg-emerald-600 text-white", "bg-emerald-200");
  if (category.includes("train")) return display("Transportation", <Train className="h-4 w-4" />, "bg-emerald-600 text-white", "bg-emerald-200");
  if (activityIdea) return display("Activity idea", <Flag className="h-4 w-4" />, "bg-slate-500 text-white", "bg-slate-200");
  if (needsLocation) return display("Needs location", <AlertTriangle className="h-4 w-4" />, "bg-amber-500 text-white", "bg-amber-200");
  return display("Place", <Landmark className="h-4 w-4" />, "bg-blue-600 text-white", "bg-blue-200");
}

function categoryDotsForDay(items: TimelineItemView[]) {
  const classes: string[] = [];

  for (const item of items) {
    const label = getSegmentDisplay(item).label;
    const dotClass =
      label === "Flight" || label === "Transportation"
        ? "bg-emerald-400"
        : label === "Hotel"
          ? "bg-violet-400"
          : label === "Restaurant"
            ? "bg-rose-400"
            : label === "Activity idea" || label === "Note"
              ? "bg-slate-400"
              : label === "Needs location"
                ? "bg-amber-400"
                : "bg-blue-400";

    if (!classes.includes(dotClass)) {
      classes.push(dotClass);
    }

    if (classes.length >= 5) {
      break;
    }
  }

  return classes.length ? classes : ["bg-slate-300"];
}

function display(label: string, icon: ReactNode, iconClass: string, lineClass: string) {
  return { icon, iconClass, label, lineClass };
}

function getItemStatus(item: TimelineItemView) {
  const base = "inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-black";
  if (item.locationStatus === "resolved" && item.startAt && item.hasStartTime) return { className: `${base} bg-emerald-50 text-emerald-700`, label: "Scheduled" };
  if (item.locationStatus === "resolved") return { className: `${base} bg-blue-50 text-blue-700`, label: "Mapped" };
  if (item.locationStatus === "needs_activity_provider") return { className: `${base} bg-slate-100 text-slate-700`, label: "Activity idea" };
  if (item.locationStatus === "provider_failed") return { className: `${base} bg-red-50 text-red-700`, label: "Provider failed" };
  return { className: `${base} bg-amber-50 text-amber-700`, label: "Needs location" };
}

function formatPrimaryTime(item: TimelineItemView) {
  if (!item.startAt || !item.hasStartTime) {
    return item.locationStatus === "needs_activity_provider" ? "Idea" : "Anytime";
  }
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC"
  }).format(new Date(item.startAt));
}

function formatSecondaryTimeLabel(item: TimelineItemView) {
  if (!item.startAt || !item.hasStartTime) {
    return item.locationStatus === "needs_activity_provider" ? "Unscheduled" : "";
  }
  return item.timeZoneLabel || "Local";
}
