import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bed,
  Car,
  CalendarDays,
  CloudSun,
  Flag,
  FileText,
  Landmark,
  Map as MapIcon,
  MoreHorizontal,
  Navigation,
  Plane,
  Plus,
  StickyNote,
  Train,
  Utensils,
  X
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
import { hasResolvedRoute, routeEndpointLabel } from "@/lib/trip-segment-route";

type TripTimelinePageProps = TripTimelineData;
type TimelinePresentationMode = "full" | "map";

export default function TripTimelinePage({
  days,
  error,
  firstFlight,
  presentationMode = "full",
  title,
  tripId
}: TripTimelinePageProps & { presentationMode?: TimelinePresentationMode }) {
  const items = days.flatMap((day) => day.items);
  const timelineItemIds = items.map((item) => item.id);
  const monthLabel = formatTimelineMonth(days);
  const activeDayLabel = formatActiveDayLabel(days);
  const mapAware = presentationMode === "map";

  return (
    <div className={mapAware ? "grid gap-4 lg:gap-5" : "grid gap-4 lg:gap-5"}>
      {mapAware ? (
        <>
          <ItineraryMapAwareMobileView
            activeDayLabel={activeDayLabel}
            days={days}
            error={error}
            items={items}
            monthLabel={monthLabel}
            title={title}
            tripId={tripId}
          />
          <div className="hidden lg:block">
            <ItineraryTimelinePanel
              days={days}
              error={error}
              mapAware={mapAware}
              monthLabel={monthLabel}
              title={title}
              tripId={tripId}
            />
          </div>
        </>
      ) : (
        <ItineraryTimelinePanel
          days={days}
          error={error}
          mapAware={false}
          monthLabel={monthLabel}
          title={title}
          tripId={tripId}
        />
      )}

      <ItineraryActions firstFlight={firstFlight} timelineItemIds={timelineItemIds} tripId={tripId} />

      {!mapAware ? <MobileTimelineBottomBar activeDayLabel={activeDayLabel} /> : null}
    </div>
  );
}

function ItineraryTimelinePanel({
  days,
  error,
  mapAware,
  monthLabel,
  title,
  tripId
}: {
  days: TripTimelineData["days"];
  error: string | null;
  mapAware: boolean;
  monthLabel: string;
  title: string;
  tripId: string;
}) {
  return (
    <section className="relative min-w-0 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/[0.88] text-white shadow-[0_22px_60px_rgba(2,6,23,0.3)] backdrop-blur-2xl lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:text-slate-950 lg:shadow-none lg:backdrop-blur-none">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.24),transparent_32%),radial-gradient(circle_at_100%_22%,rgba(249,115,22,0.12),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.74),rgba(15,23,42,0.94))] lg:hidden"
      />
      <div className="relative grid gap-4 px-3 py-3 pb-20 lg:gap-5 lg:p-0">
        <ItineraryMobileHeader monthLabel={monthLabel} title={title} tripId={tripId} />
        <ItineraryTimelineBody days={days} error={error} mapAware={mapAware} tripId={tripId} />
      </div>
    </section>
  );
}

function ItineraryTimelineBody({
  days,
  error,
  mapAware,
  tripId
}: {
  days: TripTimelineData["days"];
  error: string | null;
  mapAware: boolean;
  tripId: string;
}) {
  return (
    <>
      {error ? (
        <p className="rounded-2xl bg-amber-300/15 px-4 py-3 text-sm font-semibold text-amber-50 ring-1 ring-amber-200/20 lg:bg-amber-50 lg:text-amber-800 lg:ring-0">
          {error}
        </p>
      ) : null}

      {days.length ? (
        <div className="grid gap-5">
          <ItineraryDateStrip days={days} />

          {days.map((day) => (
            <section className="scroll-mt-24" id={dayAnchorId(day)} key={day.id}>
              <div className="sticky top-2 z-10 -mx-3 border-y border-white/10 bg-slate-900/95 px-3 py-2.5 backdrop-blur lg:static lg:mx-0 lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-white/[0.78] lg:px-4 lg:shadow-sm lg:ring-1 lg:ring-white/70">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="min-w-0 truncate text-xs font-black uppercase tracking-[0.2em] text-slate-300 lg:text-slate-700 lg:text-sm">
                    {day.date}
                  </h3>
                  <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200 shadow-sm ring-1 ring-white/10 lg:bg-white lg:text-slate-700 lg:ring-slate-200">
                    {day.items.length} place{day.items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-500 lg:text-slate-500">
                  {day.items.length} place{day.items.length === 1 ? "" : "s"} planned
                </p>
              </div>

              <div className="-mx-1 grid gap-0 rounded-[1.75rem] bg-slate-900/62 px-2 py-2 ring-1 ring-white/10 lg:mx-0 lg:mt-3 lg:bg-white lg:px-4 lg:shadow-sm lg:ring-slate-200/70">
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
    </>
  );
}

function ItineraryMapAwareMobileView({
  activeDayLabel,
  days,
  error,
  items,
  monthLabel,
  title,
  tripId
}: {
  activeDayLabel: string;
  days: TripTimelineData["days"];
  error: string | null;
  items: TimelineItemView[];
  monthLabel: string;
  title: string;
  tripId: string;
}) {
  return (
    <section
      className="relative -mx-3 -mt-3 min-h-[calc(100svh-5.75rem)] overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-[0_24px_70px_rgba(2,6,23,0.45)] sm:-mx-4 lg:hidden"
      data-testid="itinerary-map-aware-mode"
    >
      <MapAwareRoutePreview items={items} title={title} />

      <div className="relative -mt-12 rounded-t-[2rem] border-t border-white/10 bg-[#202022]/95 shadow-[0_-22px_55px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-white/35" aria-hidden="true" />
        <div className="max-h-[calc(100svh-9rem)] overflow-y-auto px-3 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-4">
          <MapAwareSheetHeader monthLabel={monthLabel} title={title} tripId={tripId} />
          <div className="mt-4">
            <ItineraryTimelineBody days={days} error={error} mapAware={true} tripId={tripId} />
          </div>
        </div>
        <MobileTimelineBottomBar activeDayLabel={activeDayLabel} variant="sheet" />
      </div>
    </section>
  );
}

function MapAwareSheetHeader({
  monthLabel,
  title,
  tripId
}: {
  monthLabel: string;
  title: string;
  tripId: string;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-black text-slate-400">{monthLabel}</p>
        <h1 className="mt-1 break-words text-3xl font-black leading-tight text-white">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          aria-label="More itinerary options"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-slate-200 transition hover:bg-white/[0.15] focus:outline-none focus:ring-4 focus:ring-white/[0.15]"
          type="button"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
        <Link
          aria-label="Close itinerary"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-slate-200 transition hover:bg-white/[0.15] focus:outline-none focus:ring-4 focus:ring-white/[0.15]"
          href={`/dashboard/trips/${encodeURIComponent(tripId)}/map`}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}

function MapAwareRoutePreview({
  items,
  title
}: {
  items: TimelineItemView[];
  title: string;
}) {
  const mappedItems = items.filter((item) => typeof item.lat === "number" && typeof item.lng === "number").slice(0, 4);
  const routeItems = mappedItems.length ? mappedItems : items.slice(0, 3);

  return (
    <div className="relative h-[48svh] min-h-[320px] overflow-hidden bg-[#07182b]" aria-label={`${title} route preview`}>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(20,184,166,0.28),transparent_28%),radial-gradient(circle_at_78%_22%,rgba(37,99,235,0.34),transparent_34%),linear-gradient(145deg,rgba(8,47,73,0.92),rgba(15,23,42,0.98))]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:44px_44px]"
      />
      <svg
        aria-hidden="true"
        className="absolute inset-x-4 top-[28%] h-[42%] w-[calc(100%-2rem)] overflow-visible"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <path
          d={routeItems.length > 1 ? "M 12 74 C 28 40, 44 88, 58 48 S 82 26, 90 58" : "M 18 62 C 36 34, 62 34, 82 62"}
          fill="none"
          stroke="rgba(56,189,248,0.88)"
          strokeLinecap="round"
          strokeWidth="5"
        />
        <path
          d={routeItems.length > 1 ? "M 12 74 C 28 40, 44 88, 58 48 S 82 26, 90 58" : "M 18 62 C 36 34, 62 34, 82 62"}
          fill="none"
          stroke="rgba(125,211,252,0.28)"
          strokeLinecap="round"
          strokeWidth="12"
        />
      </svg>
      <div className="absolute right-4 top-14 z-10 grid overflow-hidden rounded-2xl bg-black text-orange-400 shadow-2xl ring-1 ring-white/10">
        <span className="grid h-12 w-12 place-items-center border-b border-white/10">
          <MapIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="grid h-12 w-12 place-items-center">
          <Navigation className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      {routeItems.length ? (
        routeItems.map((item, index) => {
          const display = getSegmentDisplay(item);
          const position = markerPosition(index, routeItems.length);
          return (
            <div
              className="absolute z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center"
              key={item.id}
              style={{ left: `${position.left}%`, top: `${position.top}%` }}
            >
              <span className={`grid h-11 w-11 place-items-center rounded-full border-2 border-black/80 shadow-lg ${display.iconClass}`}>
                {display.icon}
              </span>
              <span className="mt-1 max-w-[88px] truncate text-center text-xs font-black text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.8)]">
                {routeMarkerLabel(item)}
              </span>
            </div>
          );
        })
      ) : (
        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-[1.5rem] bg-black/30 p-4 text-center ring-1 ring-white/10 backdrop-blur">
          <p className="text-sm font-black text-white">Map-aware itinerary</p>
          <p className="mt-1 text-xs font-semibold text-white/60">Add mapped places to draw your route.</p>
        </div>
      )}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent"
      />
    </div>
  );
}

function ItineraryMobileHeader({
  monthLabel,
  title,
  tripId
}: {
  monthLabel: string;
  title: string;
  tripId: string;
}) {
  return (
    <header className="lg:hidden">
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/[0.35]" aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-400">{monthLabel}</p>
          <h1 className="mt-1 break-words text-3xl font-black leading-tight text-white">
            {title}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            aria-label="More itinerary options"
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-slate-200 transition hover:bg-white/[0.15] focus:outline-none focus:ring-4 focus:ring-white/[0.15]"
            type="button"
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
          </button>
          <Link
            aria-label="Close itinerary"
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-slate-200 transition hover:bg-white/[0.15] focus:outline-none focus:ring-4 focus:ring-white/[0.15]"
            href={`/dashboard/trips/${encodeURIComponent(tripId)}`}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function ItineraryDateStrip({
  days
}: {
  days: TripTimelineData["days"];
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
          <Link
            aria-label={`Jump to ${day.date}`}
            className={[
              "inline-flex min-h-14 shrink-0 items-center gap-3 rounded-2xl px-3 text-left ring-1 transition focus:outline-none focus:ring-4 focus:ring-blue-100",
              index === 0
                ? "bg-orange-500/20 text-white ring-orange-400/25 lg:bg-slate-950 lg:ring-slate-950"
                : "bg-white/[0.06] text-slate-200 ring-white/10 hover:bg-white/10 lg:bg-white lg:text-slate-700 lg:ring-slate-200 lg:hover:bg-slate-50"
            ].join(" ")}
            href={`#${dayAnchorId(day)}`}
            key={day.id}
            scroll
          >
            <span className="grid gap-0.5">
              <span className={index === 0 ? "text-xs font-black uppercase tracking-[0.16em] text-orange-100/80 lg:text-white/62" : "text-xs font-black uppercase tracking-[0.16em] text-slate-500 lg:text-slate-400"}>
                {day.label}
              </span>
              <span className="text-lg font-black leading-none">{day.dayNumber}</span>
            </span>
            <span className="flex max-w-16 flex-wrap gap-1" aria-hidden="true">
              {categoryDotsForDay(day.items).map((className, dotIndex) => (
                <span className={`h-1.5 w-1.5 rounded-full ${className}`} key={`${day.id}-${dotIndex}`} />
              ))}
            </span>
            <span className={index === 0 ? "hidden rounded-full bg-white/[0.12] px-2 py-1 text-[0.65rem] font-black text-white/[0.78] lg:inline-flex" : "hidden rounded-full bg-white/10 px-2 py-1 text-[0.65rem] font-black text-slate-300 lg:inline-flex lg:bg-slate-100 lg:text-slate-600"}>
              {day.items.length}
            </span>
          </Link>
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
      className="grid grid-cols-[42px_minmax(0,1fr)] gap-3 lg:grid-cols-[48px_minmax(0,1fr)] lg:gap-4"
      id={item.id}
    >
      <div className="relative flex justify-center">
        <span
          className={`absolute top-0 w-1 rounded-full ${display.lineClass} ${
            isLast ? "bottom-5" : "bottom-0"
          }`}
          aria-hidden="true"
        />
        <span
          aria-label={`${display.label} icon`}
          className={`relative mt-3 grid h-10 w-10 place-items-center rounded-full border-4 border-slate-900 shadow-sm lg:mt-4 lg:border-[#f4f7fb] ${display.iconClass}`}
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
    <div className="min-w-0 border-b border-white/10 pb-3 lg:border-slate-200/80 lg:pb-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-500 lg:text-slate-500">
              {displayLabel}
            </p>
            <span className={`${status.className} lg:hidden`}>{status.label}</span>
          </div>
          <h4 className="mt-1 break-words text-lg font-black leading-tight text-white lg:text-xl lg:text-slate-950">
            {item.title}
          </h4>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-black leading-tight text-slate-200 lg:text-slate-800">
            {formatPrimaryTime(item)}
          </p>
          {formatSecondaryTimeLabel(item) ? (
            <p className="mt-0.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-slate-500 lg:text-slate-400">
              {formatSecondaryTimeLabel(item)}
            </p>
          ) : null}
          <span className={`${status.className} mt-2 hidden lg:inline-flex`}>{status.label}</span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_56px] items-start gap-3 lg:grid-cols-[minmax(0,1fr)_80px]">
        <div className="min-w-0">
          <TimelinePrimaryDetails item={item} />
          <ItemSource item={item} />
          <StateCopy item={item} />
        </div>

        {shouldShowTimelineThumbnail(item) ? (
          <PlacePhoto
            alt={item.imageAlt || `Photo of ${item.title}`}
            attribution={item.imageAttribution}
            className="h-14 w-14 rounded-2xl lg:h-20 lg:w-20"
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
    <div className="grid gap-1 text-sm font-semibold leading-5 text-slate-400 lg:text-slate-600">
      <p className="break-words">{item.location}</p>
      <InlineDetailList item={item} />
    </div>
  );
}

function RestaurantInlineDetails({ item }: { item: TimelineItemView }) {
  return (
    <div className="grid gap-1 text-sm font-semibold leading-5 text-slate-400 lg:text-slate-600">
      <p className="break-words">{item.location}</p>
      <p>
        {restaurantMealLabel(item)} · {formatPrimaryTime(item)}
      </p>
      <p>
        Reservation:{" "}
        <span className="font-black text-slate-200 lg:text-slate-800">
          {item.confirmationCode || item.confirmation || "optional"}
        </span>
      </p>
      <InlineDetailList item={item} />
    </div>
  );
}

function HotelInlineDetails({ item }: { item: TimelineItemView }) {
  return (
    <div className="grid gap-1 text-sm font-semibold leading-5 text-slate-400 lg:text-slate-600">
      <p className="break-words">{item.location}</p>
      <p>
        Check in:{" "}
        <span className="font-black text-slate-200 lg:text-slate-800">
          {formatHotelDateTime(item.startAt, item.hasStartTime)}
        </span>
      </p>
      <p>
        Check out:{" "}
        <span className="font-black text-slate-200 lg:text-slate-800">
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
    <div className="grid gap-2 text-sm font-semibold leading-5 text-slate-400 lg:text-slate-600">
      <div className="flex min-w-0 items-center gap-2">
        <span className="font-black text-white lg:text-slate-950">{flight.originCode}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 lg:text-slate-400" aria-hidden="true" />
        <span className="font-black text-white lg:text-slate-950">{flight.destinationCode}</span>
      </div>
      <p className="break-words">{flight.airlineLabel}</p>
      <p>
        Arrive:{" "}
        <span className="font-black text-slate-200 lg:text-slate-800">
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
    <div className="grid gap-1 text-sm font-semibold leading-5 text-slate-400 lg:text-slate-600">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate font-black text-white lg:text-slate-950">
          {routeEndpointLabel(origin) || "Origin needed"}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 lg:text-slate-400" aria-hidden="true" />
        <span className="min-w-0 truncate font-black text-white lg:text-slate-950">
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
    <p className="break-words text-xs font-bold uppercase tracking-[0.1em] text-slate-500 lg:text-slate-400">
      {details.join(" · ")}
    </p>
  );
}

function ItemSource({ item }: { item: TimelineItemView }) {
  const source = item.provider || item.meta;
  if (!source) return null;

  return (
    <p className="mt-1 truncate text-xs font-black uppercase tracking-[0.12em] text-slate-500 lg:text-slate-400">
      {source}
    </p>
  );
}

function StateCopy({ item }: { item: TimelineItemView }) {
  if (item.locationStatus === "needs_activity_provider") {
    return (
      <p className="mt-3 rounded-xl bg-blue-400/10 px-3 py-2 text-xs font-bold text-blue-100 ring-1 ring-blue-300/15 lg:bg-blue-50 lg:text-blue-800 lg:ring-0 lg:text-sm">
        Add a meeting point or provider before this appears on the map.
      </p>
    );
  }

  if (item.locationStatus !== "resolved") {
    return (
      <p className="mt-3 rounded-xl bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100 ring-1 ring-amber-200/15 lg:bg-amber-50 lg:text-amber-800 lg:ring-0 lg:text-sm">
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
      className="rounded-[1.5rem] border border-white/10 bg-white/[0.08] p-4 text-white shadow-sm backdrop-blur-xl lg:border-slate-200 lg:bg-white lg:text-slate-950 lg:backdrop-blur-none sm:rounded-3xl sm:p-5"
      id="new-plan"
    >
      <summary className="cursor-pointer text-base font-black text-white lg:text-slate-950">
        Add trip item
      </summary>
      <p className="mt-2 text-sm text-slate-400 lg:text-slate-600">Add a place, reservation, route, stay, or activity.</p>
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
        <div className="rounded-3xl bg-white p-3 text-slate-950 lg:bg-transparent lg:p-0">
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

function markerPosition(index: number, total: number) {
  if (total <= 1) return { left: 50, top: 56 };
  const positions = [
    { left: 18, top: 62 },
    { left: 38, top: 48 },
    { left: 62, top: 38 },
    { left: 82, top: 52 }
  ];
  return positions[index] || { left: 50, top: 56 };
}

function routeMarkerLabel(item: TimelineItemView) {
  if (item.route?.mode === "flight") {
    const flight = getFlightDisplay(item);
    return [flight.originCode, flight.destinationCode].filter(Boolean).join(" → ") || item.title;
  }

  return item.title;
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

function formatTimelineMonth(days: TripTimelineData["days"]) {
  const firstDatedDay = days.find((day) => day.dateIso);
  if (!firstDatedDay?.dateIso) return "Itinerary";

  return new Intl.DateTimeFormat("en", {
    month: "long",
    timeZone: "UTC",
    year: "numeric"
  }).format(new Date(`${firstDatedDay.dateIso}T00:00:00.000Z`));
}

function formatActiveDayLabel(days: TripTimelineData["days"]) {
  const firstDatedDay = days.find((day) => day.dateIso);
  if (!firstDatedDay) return "Itinerary";

  const todayIso = new Date().toISOString().slice(0, 10);
  if (firstDatedDay.dateIso === todayIso) return "Today";

  return firstDatedDay.label === "Ideas" ? "Itinerary" : firstDatedDay.label;
}

function MobileTimelineBottomBar({
  activeDayLabel,
  variant = "fixed"
}: {
  activeDayLabel: string;
  variant?: "fixed" | "sheet";
}) {
  const className = variant === "sheet"
    ? "absolute inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center justify-between rounded-[1.6rem] border border-white/10 bg-[#1b1b1d]/95 px-4 py-3 text-orange-400 shadow-2xl backdrop-blur-2xl lg:hidden"
    : "fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center justify-between rounded-[1.6rem] border border-white/10 bg-slate-950/[0.88] px-4 py-3 text-orange-400 shadow-2xl backdrop-blur-2xl lg:hidden";

  return (
    <nav
      aria-label="Itinerary quick actions"
      className={className}
    >
      <CalendarDays className="h-5 w-5" aria-hidden="true" />
      <span className="text-base font-black">{activeDayLabel}</span>
      <Link
        aria-label="Add itinerary item"
        className="grid h-11 w-11 place-items-center rounded-full text-orange-400 transition hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
        href="#new-plan"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </Link>
    </nav>
  );
}
