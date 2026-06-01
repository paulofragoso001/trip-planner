import Link from "next/link";
import {
  AlertTriangle,
  Bed,
  CalendarDays,
  Car,
  Clock,
  Flag,
  Landmark,
  MapPin,
  MoreHorizontal,
  Plane,
  Plus,
  ReceiptText,
  Share2,
  Sparkles,
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
import { EmptyState, StatusBadge } from "@/components/trip-ui";
import { waylineCopy } from "@/lib/copy/wayline-copy";

type TripTimelinePageProps = TripTimelineData;

export default function TripTimelinePage({
  days,
  description,
  error,
  firstFlight,
  stats,
  title,
  tripId
}: TripTimelinePageProps) {
  const items = days.flatMap((day) => day.items);
  const timelineItemIds = items.map((item) => item.id);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0">
        <ItineraryHero
          description={description}
          stats={stats}
          title={title}
          tripId={tripId}
        />

        {error ? (
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {error}
          </p>
        ) : null}

        {days.length ? (
          <div className="mt-5 grid gap-5">
            {days.map((day) => (
              <section className="scroll-mt-24" id={day.id} key={day.id}>
                <div className="sticky top-14 z-10 -mx-3 border-y border-slate-200 bg-slate-100/95 px-3 py-2 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-xs font-black uppercase tracking-[0.2em] text-slate-700">
                        {day.date}
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {day.summary}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
                      {day.items.length} place{day.items.length === 1 ? "" : "s"}
                    </span>
                  </div>
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
                    Add place
                  </Link>
                </div>
              }
              description="Add inspiration or create a place to start building your trip."
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

function ItineraryHero({
  description,
  stats,
  title,
  tripId
}: {
  description: string;
  stats: TripTimelineData["stats"];
  title: string;
  tripId: string;
}) {
  return (
    <header className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_180px] md:items-stretch">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-black text-slate-600">
            <Link className="rounded-full bg-slate-100 px-3 py-2 transition hover:bg-slate-200" href="/dashboard/trips">
              Back
            </Link>
            <span className="text-xs uppercase tracking-[0.18em] text-blue-600">Itinerary</span>
          </div>
          <h1 className="mt-4 break-words text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
            {description}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge tone="blue">{stats.totalItems} places</StatusBadge>
            <StatusBadge tone={stats.mappedStops ? "green" : "slate"}>
              {stats.mappedStops} mapped
            </StatusBadge>
            <StatusBadge tone={stats.alerts ? "amber" : "green"}>
              {stats.alerts} needs location
            </StatusBadge>
          </div>
        </div>

        <div className="relative min-h-28 overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#2563eb,#0f172a)] p-4 text-white">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/20" />
          <div className="absolute -bottom-8 left-5 h-24 w-24 rounded-full bg-sky-300/20" />
          <div className="relative flex h-full flex-col justify-between gap-4">
            <div className="flex justify-end gap-2">
              <Link
                aria-label="Share trip"
                className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur transition hover:bg-white/25"
                href={`/dashboard/trips/${tripId}/sharing`}
              >
                <Share2 className="h-4 w-4" />
              </Link>
              <button
                aria-label="More itinerary actions"
                className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur"
                type="button"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm font-black">Route-ready trip plan</p>
          </div>
        </div>
      </div>
    </header>
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
      className="grid grid-cols-[68px_34px_minmax(0,1fr)] gap-2 sm:grid-cols-[92px_44px_minmax(0,1fr)] sm:gap-3"
      id={item.id}
    >
      <div className="pt-5 text-right">
        <p className="text-sm font-black text-slate-950">{formatPrimaryTime(item)}</p>
        <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-500">
          {item.startAt ? "Local" : "Anytime"}
        </p>
      </div>

      <div className="relative flex justify-center">
        {!isLast ? <span className={`absolute bottom-0 top-0 w-0.5 ${display.lineClass}`} /> : null}
        <span className={`relative mt-5 grid h-9 w-9 place-items-center rounded-full border-4 border-white shadow-sm ${display.iconClass}`}>
          {display.icon}
        </span>
      </div>

      <div className="min-w-0 pb-4 pt-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_96px] sm:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    {display.label}
                  </p>
                  <h4 className="mt-1 break-words text-lg font-black leading-tight text-slate-950">
                    {item.title}
                  </h4>
                </div>
                <span className={status.className}>{status.label}</span>
              </div>
            </div>
            {shouldShowPlacePhoto(item) ? (
              <PlacePhoto
                alt={item.imageAlt || `Photo of ${item.title}`}
                attribution={item.imageAttribution}
                className="h-24 w-full rounded-2xl sm:h-24 sm:w-24"
                fallbackLabel={item.typeLabel || "Place"}
                src={item.imageUrl}
              />
            ) : null}
          </div>

          <div className="mt-3 grid gap-2 text-sm text-slate-700">
            <Detail icon={<Clock className="h-4 w-4" />} value={item.timeRange} />
            <Detail icon={<MapPin className="h-4 w-4" />} value={item.location} />
            {item.confirmationCode ? (
              <Detail icon={<ReceiptText className="h-4 w-4" />} value={`Confirmation ${item.confirmationCode}`} />
            ) : null}
            {item.durationLabel ? <Detail icon={<CalendarDays className="h-4 w-4" />} value={item.durationLabel} /> : null}
            {item.provider ? <Detail icon={<Sparkles className="h-4 w-4" />} value={item.provider.replace(/_/g, " ")} /> : null}
          </div>

          <StateCopy item={item} />

          <ItineraryCardActions item={item} tripId={tripId} />
        </div>
      </div>
    </article>
  );
}

function Detail({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 shrink-0 text-slate-400">{icon}</span>
      <span className="min-w-0 break-words">{value}</span>
    </div>
  );
}

function StateCopy({ item }: { item: TimelineItemView }) {
  if (item.locationStatus === "needs_activity_provider") {
    return (
      <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
        Add a meeting point or provider before this appears on the map.
      </p>
    );
  }

  if (item.locationStatus !== "resolved") {
    return (
      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
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
  if (category.includes("transport")) return display("Transportation", <Car className="h-4 w-4" />, "bg-emerald-600 text-white", "bg-emerald-200");
  if (category.includes("train")) return display("Transportation", <Train className="h-4 w-4" />, "bg-emerald-600 text-white", "bg-emerald-200");
  if (activityIdea) return display("Activity idea", <Flag className="h-4 w-4" />, "bg-slate-500 text-white", "bg-slate-200");
  if (needsLocation) return display("Needs location", <AlertTriangle className="h-4 w-4" />, "bg-amber-500 text-white", "bg-amber-200");
  return display("Place", <Landmark className="h-4 w-4" />, "bg-blue-600 text-white", "bg-blue-200");
}

function display(label: string, icon: ReactNode, iconClass: string, lineClass: string) {
  return { icon, iconClass, label, lineClass };
}

function getItemStatus(item: TimelineItemView) {
  const base = "inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-black";
  if (item.locationStatus === "resolved" && item.startAt) return { className: `${base} bg-emerald-50 text-emerald-700`, label: "Scheduled" };
  if (item.locationStatus === "resolved") return { className: `${base} bg-blue-50 text-blue-700`, label: "Mapped" };
  if (item.locationStatus === "needs_activity_provider") return { className: `${base} bg-slate-100 text-slate-700`, label: "Activity idea" };
  if (item.locationStatus === "provider_failed") return { className: `${base} bg-red-50 text-red-700`, label: "Provider failed" };
  return { className: `${base} bg-amber-50 text-amber-700`, label: "Needs location" };
}

function formatPrimaryTime(item: TimelineItemView) {
  if (!item.startAt) return item.locationStatus === "needs_activity_provider" ? "Idea" : "Anytime";
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC"
  }).format(new Date(item.startAt));
}
