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
import { GeneratePlanButton } from "@/components/trip/generate-plan-button";
import { ItineraryCardActions } from "@/components/trip/itinerary-card-actions";
import { TripSegmentForm } from "@/components/trip/trip-segment-form";
import { EmptyState } from "@/components/trip-ui";
import { waylineCopy } from "@/lib/copy/wayline-copy";
import { hasResolvedRoute, routeEndpointLabel } from "@/lib/trip-segment-route";

type TripTimelinePageProps = TripTimelineData;

export default function TripTimelinePage({
  days,
  error,
  firstFlight,
  tripId
}: TripTimelinePageProps) {
  const items = days.flatMap((day) => day.items);
  const timelineItemIds = items.map((item) => item.id);

  return (
    <div className="grid gap-5">
      <section className="min-w-0">
        {error ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {error}
          </p>
        ) : null}

        {days.length ? (
          <div className="grid gap-5">
            <ItineraryDateStrip days={days} tripId={tripId} />

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

                <div className="-mx-3 grid gap-0 bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200/70 sm:mx-0 sm:mt-3 sm:rounded-[1.75rem] sm:px-4">
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

      <ItineraryActions firstFlight={firstFlight} timelineItemIds={timelineItemIds} tripId={tripId} />

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

function ItineraryDateStrip({
  days,
  tripId
}: {
  days: TripTimelineData["days"];
  tripId: string;
}) {
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
            href={`/dashboard/trips/${encodeURIComponent(tripId)}/timeline#${dayAnchorId(day)}`}
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
      className="grid grid-cols-[70px_38px_minmax(0,1fr)] gap-2 sm:grid-cols-[96px_44px_minmax(0,1fr)] sm:gap-4"
      id={item.id}
    >
      <div className="pt-4 text-right sm:pt-5">
        <p className="text-base font-black leading-tight text-slate-950 sm:text-lg">
          {formatPrimaryTime(item)}
        </p>
        {formatSecondaryTimeLabel(item) ? (
          <p className="mt-0.5 text-[0.68rem] font-bold uppercase leading-tight tracking-[0.12em] text-slate-500">
            {formatSecondaryTimeLabel(item)}
          </p>
        ) : null}
      </div>

      <div className="relative flex justify-center">
        <span
          className={`absolute top-0 w-1 rounded-full ${display.lineClass} ${
            isLast ? "bottom-5" : "bottom-0"
          }`}
          aria-hidden="true"
        />
        <span
          aria-label={`${display.label} icon`}
          className={`relative mt-3 grid h-10 w-10 place-items-center rounded-full border-4 border-[#f4f7fb] shadow-sm sm:mt-4 ${display.iconClass}`}
          data-testid="itinerary-category-icon"
        >
          {display.icon}
        </span>
      </div>

      <div className="min-w-0 pb-3 pt-2 sm:pb-4 sm:pt-3">
        <TimelineCompactItem displayLabel={display.label} item={item} status={status} tripId={tripId} />
      </div>
    </article>
  );
}

function TimelineCompactItem({
  displayLabel,
  item,
  status,
  tripId
}: {
  displayLabel: string;
  item: TimelineItemView;
  status: { className: string; label: string };
  tripId: string;
}) {
  return (
    <div className="min-w-0 border-b border-slate-200/80 pb-3 sm:pb-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-500">
            {displayLabel}
          </p>
          <h4 className="mt-1 break-words text-lg font-black leading-tight text-slate-950 sm:text-xl">
            {item.title}
          </h4>
        </div>
        <span className={`${status.className} shrink-0`}>{status.label}</span>
      </div>

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_64px] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_80px]">
        <div className="min-w-0">
          <TimelinePrimaryDetails item={item} />
          <ItemSource item={item} />
          <StateCopy item={item} />
        </div>

        {shouldShowTimelineThumbnail(item) ? (
          <PlacePhoto
            alt={item.imageAlt || `Photo of ${item.title}`}
            attribution={item.imageAttribution}
            className="h-16 w-16 rounded-2xl sm:h-20 sm:w-20"
            fallbackLabel={item.typeLabel || displayLabel}
            src={item.imageUrl}
          />
        ) : null}
      </div>

      <ItineraryCardActions item={item} tripId={tripId} />
    </div>
  );
}

function shouldShowTimelineThumbnail(item: TimelineItemView) {
  return !item.route && item.kind !== "flight";
}

function TimelinePrimaryDetails({ item }: { item: TimelineItemView }) {
  if (item.route) {
    return <RouteInlineDetails item={item} />;
  }

  if (item.kind === "flight") {
    return <FlightInlineDetails item={item} />;
  }

  if (item.kind === "hotel") {
    return <HotelInlineDetails item={item} />;
  }

  if (item.kind === "restaurant") {
    return <RestaurantInlineDetails item={item} />;
  }

  return <GeneralInlineDetails item={item} />;
}

function GeneralInlineDetails({ item }: { item: TimelineItemView }) {
  return (
    <div className="grid gap-1 text-sm font-semibold leading-5 text-slate-600">
      <p className="break-words">{item.location}</p>
      <InlineDetailList item={item} />
    </div>
  );
}

function RestaurantInlineDetails({ item }: { item: TimelineItemView }) {
  return (
    <div className="grid gap-1 text-sm font-semibold leading-5 text-slate-600">
      <p className="break-words">{item.location}</p>
      <p>
        {restaurantMealLabel(item)} · {formatPrimaryTime(item)}
      </p>
      <p>
        Reservation:{" "}
        <span className="font-black text-slate-800">
          {item.confirmationCode || item.confirmation || "optional"}
        </span>
      </p>
      <InlineDetailList item={item} />
    </div>
  );
}

function HotelInlineDetails({ item }: { item: TimelineItemView }) {
  return (
    <div className="grid gap-1 text-sm font-semibold leading-5 text-slate-600">
      <p className="break-words">{item.location}</p>
      <p>
        Check in:{" "}
        <span className="font-black text-slate-800">
          {formatHotelDateTime(item.startAt, item.hasStartTime)}
        </span>
      </p>
      <p>
        Check out:{" "}
        <span className="font-black text-slate-800">
          {formatHotelDateTime(item.endAt, item.hasEndTime)}
        </span>
      </p>
      <InlineDetailList item={item} />
    </div>
  );
}

function FlightInlineDetails({ item }: { item: TimelineItemView }) {
  const flight = getFlightDisplay(item);

  return (
    <div className="grid gap-2 text-sm font-semibold leading-5 text-slate-600">
      <div className="flex min-w-0 items-center gap-2">
        <span className="font-black text-slate-950">{flight.originCode}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <span className="font-black text-slate-950">{flight.destinationCode}</span>
      </div>
      <p className="break-words">{flight.airlineLabel}</p>
      <p>
        Arrive:{" "}
        <span className="font-black text-slate-800">
          {flight.arrivalTime} {item.timeZoneLabel || ""}
        </span>
      </p>
      <InlineDetailList item={item} />
    </div>
  );
}

function RouteInlineDetails({ item }: { item: TimelineItemView }) {
  const route = item.route;
  const origin = route?.origin;
  const destination = route?.destination;
  const routeReady = hasResolvedRoute(route);

  return (
    <div className="grid gap-1 text-sm font-semibold leading-5 text-slate-600">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate font-black text-slate-950">
          {routeEndpointLabel(origin) || "Origin needed"}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <span className="min-w-0 truncate font-black text-slate-950">
          {routeEndpointLabel(destination) || "Destination needed"}
        </span>
      </div>
      <p>{routeReady ? "Route ready" : "Add origin and destination to draw this route."}</p>
      {route?.carrier || route?.flightNumber || route?.confirmation ? (
        <p className="break-words">
          {[route.carrier, route.flightNumber, route.confirmation].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      <InlineDetailList item={item} />
    </div>
  );
}

function InlineDetailList({ item }: { item: TimelineItemView }) {
  const details = [
    item.confirmationCode ? `Confirmation ${item.confirmationCode}` : null,
    item.durationLabel,
    item.costLabel
  ].filter(Boolean);

  if (!details.length) return null;

  return (
    <p className="break-words text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
      {details.join(" · ")}
    </p>
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

function restaurantMealLabel(item: TimelineItemView) {
  const source = `${item.meta} ${item.typeLabel} ${item.title}`.toLowerCase();
  if (source.includes("breakfast")) return "Breakfast";
  if (source.includes("brunch")) return "Brunch";
  if (source.includes("lunch")) return "Lunch";
  if (source.includes("bar") || source.includes("drinks")) return "Drinks";
  return "Dinner";
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
    <details
      className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5"
      id="new-plan"
    >
      <summary className="cursor-pointer text-base font-black text-slate-950">
        Add trip item
      </summary>
      <p className="mt-2 text-sm text-slate-600">Add a place, reservation, route, stay, or activity.</p>
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
          <div className="hidden xl:block">
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
          </div>
        ) : null}
        <div>
          <TripSegmentForm buttonLabel="Add trip item" tripId={tripId} />
        </div>
      </div>
    </details>
  );
}

function getSegmentDisplay(item: TimelineItemView) {
  if (item.route?.mode === "flight") return display("Flight", <Plane className="h-4 w-4" />, "bg-emerald-600 text-white", "bg-emerald-200");
  if (item.route?.mode === "train") return display("Transportation", <Train className="h-4 w-4" />, "bg-emerald-600 text-white", "bg-emerald-200");
  if (item.route) return display("Transportation", <Car className="h-4 w-4" />, "bg-emerald-600 text-white", "bg-emerald-200");

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

function airportCodeFromEndpoint(
  endpoint: { address?: string | null; code?: string | null; label?: string | null } | null | undefined
) {
  const text = `${endpoint?.code || ""} ${endpoint?.label || ""} ${endpoint?.address || ""}`;
  const explicit = text.match(/\b[A-Z]{3}\b/);
  if (explicit) return explicit[0];
  const words = (endpoint?.label || endpoint?.address || "")
    .replace(/[^a-zA-Z\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((word) => word[0]).join("").toUpperCase();
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
