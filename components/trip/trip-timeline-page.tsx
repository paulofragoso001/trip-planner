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
  MoreHorizontal,
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
import { MobileMapPreview } from "@/components/trip/mobile-map-preview";
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
    <div className="grid gap-4 lg:gap-5">
      <ItineraryMapAwareMobileView
        activeDayLabel={activeDayLabel}
        closeHref={`/dashboard/trips/${encodeURIComponent(tripId)}${mapAware ? "/map" : ""}`}
        days={days}
        error={error}
        items={items}
        monthLabel={monthLabel}
        title={title}
        tripId={tripId}
      />
      <div className={mapAware ? "hidden lg:block" : "hidden lg:block"}>
        <ItineraryTimelinePanel
          days={days}
          error={error}
          mapAware={mapAware}
          monthLabel={monthLabel}
          title={title}
          tripId={tripId}
        />
      </div>

      {mapAware ? (
        <div className="hidden lg:block">
          <ItineraryActions firstFlight={firstFlight} timelineItemIds={timelineItemIds} tripId={tripId} />
        </div>
      ) : (
        <div className="hidden lg:block">
          <ItineraryActions firstFlight={firstFlight} timelineItemIds={timelineItemIds} tripId={tripId} />
        </div>
      )}
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
        <div className="grid gap-0 lg:gap-5" data-testid="itinerary-route-list">
          <ItineraryDateStrip days={days} />

          {days.map((day) => {
            const lodgingContext = day.items.find((item) => item.kind === "hotel");

            return (
            <section className="scroll-mt-24" id={dayAnchorId(day)} key={day.id}>
              <div className={mapAware
                ? "-mx-3 border-b border-white/10 bg-[#202022] px-3 py-3 lg:mx-0 lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-white/[0.78] lg:px-4 lg:shadow-sm lg:ring-1 lg:ring-white/70"
                : "sticky top-0 z-10 -mx-3 border-b border-white/10 bg-[#202022]/96 px-3 py-3 backdrop-blur lg:static lg:mx-0 lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-white/[0.78] lg:px-4 lg:shadow-sm lg:ring-1 lg:ring-white/70"
              }>
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

              {lodgingContext ? <LodgingContextRow item={lodgingContext} /> : null}

              <div className="-mx-3 grid gap-0 border-b border-white/10 bg-[#202022] px-3 lg:mx-0 lg:mt-3 lg:rounded-[1.75rem] lg:border-0 lg:bg-white lg:px-4 lg:py-2 lg:shadow-sm lg:ring-1 lg:ring-slate-200/70">
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
            );
          })}
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState
            action={
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-black text-white"
                  href="/dashboard/plan"
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
  closeHref,
  days,
  error,
  items,
  monthLabel,
  title,
  tripId
}: {
  activeDayLabel: string;
  closeHref: string;
  days: TripTimelineData["days"];
  error: string | null;
  items: TimelineItemView[];
  monthLabel: string;
  title: string;
  tripId: string;
}) {
  return (
    <section
      className="relative min-h-[100svh] overflow-hidden bg-slate-950 text-white shadow-[0_24px_70px_rgba(2,6,23,0.45)] lg:hidden"
      data-testid="itinerary-map-aware-mode"
    >
      <MapAwareRoutePreview items={items} title={title} />

      <div
        className="absolute inset-x-0 bottom-0 z-20 flex max-h-[60svh] flex-col rounded-t-[1.75rem] border-t border-white/10 bg-[#202022]/96 shadow-[0_-22px_55px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
        data-testid="map-aware-sheet"
      >
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-white/35" aria-hidden="true" />
        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-4"
          data-testid="map-aware-sheet-scroll"
        >
          <MapAwareSheetHeader closeHref={closeHref} monthLabel={monthLabel} title={title} tripId={tripId} />
          <div className="mt-4">
            <ItineraryTimelineBody days={days} error={error} mapAware={true} tripId={tripId} />
          </div>
          <MobileAddTripItem tripId={tripId} />
        </div>
        <MobileTimelineBottomBar activeDayLabel={activeDayLabel} tripId={tripId} variant="sheet" />
      </div>
    </section>
  );
}

function MapAwareSheetHeader({
  closeHref,
  monthLabel,
  title,
  tripId
}: {
  closeHref: string;
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
        <ItineraryMoreMenu tripId={tripId} />
        <Link
          aria-label="Close itinerary"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-slate-200 transition hover:bg-white/[0.15] focus:outline-none focus:ring-4 focus:ring-white/[0.15]"
          href={closeHref}
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
  const mappedItems = items
    .filter((item) => hasResolvedRoute(item.route) || (typeof item.lat === "number" && typeof item.lng === "number"))
    .slice(0, 5)
    .map((item, index) => ({
      category: item.typeLabel,
      dayLabel: item.displayDate,
      id: item.id,
      imageAlt: item.imageAlt,
      imageAttribution: item.imageAttribution,
      imageUrl: item.imageUrl,
      lat: item.lat ?? item.route?.destination?.lat ?? item.route?.origin?.lat ?? 0,
      lng: item.lng ?? item.route?.destination?.lng ?? item.route?.origin?.lng ?? 0,
      route: item.route,
      routeOrder: index + 1,
      title: item.title
    }));
  const label = mappedItems.length
    ? `${mappedItems.length} mapped place${mappedItems.length === 1 ? "" : "s"}`
    : "Map preview";

  return (
    <MobileMapPreview
      height="48svh"
      items={mappedItems}
      label={label}
      title={`${title} route preview map`}
    />
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
          <ItineraryMoreMenu tripId={tripId} />
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
      className="overflow-x-auto border-b border-white/10 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-testid="itinerary-date-strip"
    >
      <div className="flex min-w-max gap-5 px-0.5">
        {datedDays.map((day, index) => (
          <a
            aria-label={`Jump to ${day.date}`}
            className={[
              "grid min-h-[4.9rem] w-12 shrink-0 place-items-center gap-1 rounded-2xl px-1 py-2 text-center transition focus:outline-none focus:ring-4 focus:ring-orange-300/20",
              index === 0
                ? "bg-orange-500/22 text-white"
                : "text-slate-300 hover:bg-white/[0.06] lg:text-slate-700"
            ].join(" ")}
            href={`#${dayAnchorId(day)}`}
            key={day.id}
          >
            <span className="grid gap-1">
              <span className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-400">
                {day.label}
              </span>
              <span className={index === 0 ? "grid h-9 w-9 place-items-center rounded-full bg-orange-500/35 text-base font-black leading-none text-orange-100" : "text-base font-semibold leading-none"}>
                {day.dayNumber}
              </span>
            </span>
            <span className="flex h-2 max-w-10 flex-wrap justify-center gap-1" aria-hidden="true">
              {categoryDotsForDay(day.items).map((className, dotIndex) => (
                <span className={`h-1.5 w-1.5 rounded-full ${className}`} key={`${day.id}-${dotIndex}`} />
              ))}
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

function LodgingContextRow({ item }: { item: TimelineItemView }) {
  return (
    <div className="-mx-3 block border-b border-white/10 bg-white/[0.06] px-3 py-2 lg:hidden">
      <div className="flex min-w-0 items-center gap-2 rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-bold text-slate-300">
        <Bed className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <span className="min-w-0 truncate">{item.title}</span>
      </div>
    </div>
  );
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
      className="grid grid-cols-[46px_minmax(0,1fr)] gap-2 lg:grid-cols-[48px_minmax(0,1fr)] lg:gap-4"
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
          className={`relative mt-3 grid h-9 w-9 place-items-center rounded-full border-4 border-[#202022] shadow-sm lg:mt-4 lg:h-10 lg:w-10 lg:border-[#f4f7fb] ${display.iconClass}`}
          data-testid="itinerary-category-icon"
        >
          {display.icon}
        </span>
      </div>

      <div className="min-w-0 pb-2 pt-2 sm:pb-3 sm:pt-3">
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
    <div className="min-w-0 border-b border-white/10 pb-2.5 lg:border-slate-200/80 lg:pb-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-[0.66rem] font-black uppercase tracking-[0.14em] text-slate-500 lg:text-slate-500">
              {displayLabel}
            </p>
          </div>
          <h4 className="mt-1 line-clamp-2 break-words text-base font-black leading-tight text-white lg:text-xl lg:text-slate-950">
            {item.title}
          </h4>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-black leading-tight text-slate-300 lg:text-slate-800">
            {formatPrimaryTime(item)}
          </p>
          {formatSecondaryTimeLabel(item) ? (
            <p className="mt-0.5 text-[0.6rem] font-black uppercase tracking-[0.1em] text-slate-500 lg:text-slate-400">
              {formatSecondaryTimeLabel(item)}
            </p>
          ) : null}
          <span className={`${status.className} mt-2 hidden lg:inline-flex`}>{status.label}</span>
        </div>
      </div>

      <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 lg:mt-2 lg:grid-cols-[minmax(0,1fr)_80px]">
        <div className="min-w-0">
          <TimelinePrimaryDetails item={item} />
          <ItemSource item={item} />
          <StateCopy item={item} />
        </div>

        {shouldShowTimelineThumbnail(item) ? (
          <PlacePhoto
            alt={item.imageAlt || `Photo of ${item.title}`}
            attribution={item.imageAttribution}
            className="h-12 w-12 rounded-xl lg:h-20 lg:w-20 lg:rounded-2xl"
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
      <p className="line-clamp-1 break-words lg:line-clamp-none">{item.location}</p>
      <InlineDetailList item={item} />
    </div>
  );
}

function RestaurantInlineDetails({ item }: { item: TimelineItemView }) {
  return (
    <div className="grid gap-1 text-sm font-semibold leading-5 text-slate-400 lg:text-slate-600">
      <p className="line-clamp-1 break-words lg:line-clamp-none">{item.location}</p>
      <p className="hidden lg:block">
        {restaurantMealLabel(item)} · {formatPrimaryTime(item)}
      </p>
      <p className="hidden lg:block">
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
      <p className="line-clamp-1 break-words lg:line-clamp-none">{item.location}</p>
      <p className="hidden lg:block">
        Check in:{" "}
        <span className="font-black text-slate-200 lg:text-slate-800">
          {formatHotelDateTime(item.startAt, item.hasStartTime)}
        </span>
      </p>
      <p className="hidden lg:block">
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
    <div className="grid gap-1 text-sm font-semibold leading-5 text-slate-400 lg:gap-2 lg:text-slate-600">
      <div className="flex min-w-0 items-center gap-2">
        <span className="font-black text-white lg:text-slate-950">{flight.originCode}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 lg:text-slate-400" aria-hidden="true" />
        <span className="font-black text-white lg:text-slate-950">{flight.destinationCode}</span>
      </div>
      <p className="line-clamp-1 break-words">{flight.airlineLabel}</p>
      <p className="hidden lg:block">
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
      <p className="line-clamp-1">{routeReady ? "Route ready" : "Add origin and destination to draw this route."}</p>
      {route?.carrier || route?.flightNumber || route?.confirmation ? (
        <p className="line-clamp-1 break-words">
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
      id="desktop-new-plan"
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
  tripId,
  variant = "fixed"
}: {
  activeDayLabel: string;
  tripId: string;
  variant?: "fixed" | "sheet";
}) {
  const className = variant === "sheet"
    ? "z-30 mx-3 mb-[calc(0.75rem+env(safe-area-inset-bottom))] flex w-[calc(100%-1.5rem)] max-w-md items-center justify-between self-center rounded-[1.6rem] border border-white/10 bg-[#1b1b1d]/95 px-4 py-3 text-orange-400 shadow-2xl backdrop-blur-2xl lg:hidden"
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
        href={`/dashboard/trips/${encodeURIComponent(tripId)}/timeline#new-plan`}
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </Link>
    </nav>
  );
}

function ItineraryMoreMenu({ tripId }: { tripId: string }) {
  const base = `/dashboard/trips/${encodeURIComponent(tripId)}`;

  return (
    <details className="relative z-50" suppressHydrationWarning>
      <summary
        aria-label="More itinerary options"
        className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full bg-white/10 text-slate-200 transition hover:bg-white/[0.15] focus:outline-none focus:ring-4 focus:ring-white/[0.15] [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-[80] mt-2 w-44 overflow-hidden rounded-2xl bg-[#111113]/98 p-1 text-sm font-black text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl">
        <Link className="block rounded-xl px-3 py-3 hover:bg-white/10" href={`${base}/budget`}>
          Expenses
        </Link>
        <Link className="block rounded-xl px-3 py-3 hover:bg-white/10" href={`${base}/documents`}>
          Documents
        </Link>
        <Link className="block rounded-xl px-3 py-3 hover:bg-white/10" href={`${base}/share`}>
          Share
        </Link>
        <Link className="block rounded-xl px-3 py-3 hover:bg-white/10" href={`${base}`}>
          Settings
        </Link>
      </div>
    </details>
  );
}

function MobileAddTripItem({ tripId }: { tripId: string }) {
  return (
    <details
      className="mt-4 rounded-[1.5rem] bg-[#171719] p-3 text-white ring-1 ring-white/10"
      id="new-plan"
    >
      <summary className="cursor-pointer text-sm font-black text-orange-400">
        Add trip item
      </summary>
      <div className="mt-3 rounded-2xl bg-white p-2 text-slate-950">
        <TripSegmentForm buttonLabel="Add trip item" tripId={tripId} />
      </div>
    </details>
  );
}
