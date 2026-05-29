import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Hotel,
  MapPin,
  Plane,
  ReceiptText,
  Route,
  Utensils
} from "lucide-react";
import type { ReactNode } from "react";
import type {
  TimelineItemView,
  TripTimelineData
} from "@/app/dashboard/trips/[tripId]/timeline/types";
import { AsyncActionButton } from "@/components/dashboard/async-action-button";
import { CalendarSyncPanel } from "@/components/trip/calendar-sync-panel";
import { GeneratePlanButton } from "@/components/trip/generate-plan-button";
import { TripSegmentDeleteButton } from "@/components/trip/trip-segment-delete-button";
import { TripSegmentForm } from "@/components/trip/trip-segment-form";
import { timelineStatusClass, timelineStatusLabel } from "@/lib/ui/timeline";

type TripTimelinePageProps = TripTimelineData;

export default function TripTimelinePage({
  dayTabs,
  days,
  description,
  error,
  firstFlight,
  stats,
  title,
  tripId
}: TripTimelinePageProps) {
  const timelineItemIds = days.flatMap((day) => day.items.map((item) => item.id));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div className="min-w-0">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Timeline</h2>
            <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">{title}</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
            <StatPill label="Stops" value={String(stats.totalItems)} />
            <StatPill label="Mapped" value={String(stats.mappedStops)} />
            <StatPill label="Needs attention" value={String(stats.alerts)} />
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {error}
          </p>
        ) : null}

        {dayTabs.length ? (
          <div
            aria-label="Trip days"
            className="mt-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="flex gap-3 overflow-x-auto pb-1">
            {dayTabs.map((day, index) => (
              <a
                className={[
                  "min-w-[128px] rounded-xl border px-4 py-3 text-left transition",
                  index === 0
                    ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                ].join(" ")}
                href={day.href}
                key={day.date}
              >
                <span className="block text-xs font-bold uppercase tracking-[0.18em] opacity-75">
                  {day.label}
                </span>
                <span className="mt-1 block text-sm font-black">{day.date}</span>
                <span className="mt-1 block text-xs font-semibold opacity-80">
                  {day.count} plans
                </span>
              </a>
            ))}
            </div>
          </div>
        ) : null}

        <div className="mt-8 grid gap-10">
          {days.length ? (
            days.map((day) => (
            <section className="grid gap-4 scroll-mt-24" id={day.id} key={day.id}>
              <div className="grid gap-4 md:grid-cols-[104px_minmax(0,1fr)]">
                <div className="md:self-start">
                  <div className="rounded-2xl bg-slate-950 px-4 py-4 text-white shadow-sm">
                    <span className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
                      {day.label}
                    </span>
                    <span className="mt-1 block text-3xl font-black leading-none">{day.dayNumber}</span>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="mb-3 flex flex-col gap-1 border-b border-slate-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-xl font-black text-slate-950">{day.date}</h3>
                      <p className="text-sm text-slate-600">{day.summary}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      <span>{day.items.length} plan{day.items.length === 1 ? "" : "s"}</span>
                      <span>{formatDistance(day.routeSummary.totalDistanceMeters)}</span>
                      <span>{formatDuration(day.routeSummary.estimatedDurationMinutes)}</span>
                    </div>
                  </div>

                  {day.routeSummary.warnings.length ? (
                    <div className="mb-3 grid gap-2">
                      {day.routeSummary.warnings.map((warning) => (
                        <p
                          className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800"
                          key={warning.code}
                        >
                          {warning.message}
                        </p>
                      ))}
                    </div>
                  ) : null}

                  <DayRoutePreview
                    day={day}
                    tripId={tripId}
                  />

                  <div className="relative grid gap-3">
                    <div className="absolute bottom-8 left-[23px] top-8 hidden w-px bg-slate-200 sm:block" />
                    {day.items.map((item) => (
                      <TimelineCard item={item} key={item.id} tripId={tripId} />
                    ))}
                  </div>
                </div>
              </div>
            </section>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-sm text-slate-600">
              <p className="font-bold text-slate-950">No stops yet.</p>
              <p className="mt-1">Add inspiration or create a stop to start building your trip.</p>
            </div>
          )}
        </div>
      </section>

      <aside className="grid content-start gap-4 xl:sticky xl:top-24 xl:self-start">
        <TimelineTools firstFlight={firstFlight} tripId={tripId} timelineItemIds={timelineItemIds} />
        <TripOpsSummary mappedStops={stats.mappedStops} readyItems={stats.readyItems} totalItems={stats.totalItems} watchItems={stats.alerts} />
        <CalendarSyncPanel tripId={tripId} />
      </aside>
    </div>
  );
}

function TimelineTools({
  firstFlight,
  timelineItemIds,
  tripId
}: {
  firstFlight: TimelineItemView | null;
  timelineItemIds: string[];
  tripId: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-black">Plan tools</h3>
      <p className="mt-2 text-sm text-slate-600">
        Generate the day order, add stops, and keep the plan ready for maps and sharing.
      </p>
      <div className="mt-4 grid gap-3">
        <GeneratePlanButton context="timeline" tripId={tripId} />
        <AsyncActionButton
          body={{ orderedItemIds: timelineItemIds, tripId }}
          endpoint="/api/itinerary/reorder"
          successMessage="Timeline order saved."
        >
          Reorder items
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
        ) : (
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
            Add a flight segment to enable flight refresh.
          </p>
        )}
        <Link
          className="rounded-2xl bg-slate-100 px-4 py-3 text-left font-semibold transition hover:bg-slate-200"
          href={`/dashboard/trips/${tripId}#new-plan`}
        >
            Add stop
        </Link>
        <div id="new-plan">
          <TripSegmentForm buttonLabel="Add stop" tripId={tripId} />
        </div>
      </div>
    </div>
  );
}

function TimelineCard({ item, tripId }: { item: TimelineItemView; tripId: string }) {
  return (
    <article className="relative grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:grid-cols-[48px_minmax(0,1fr)]">
      <div className="relative hidden sm:block">
        <div className="relative z-10 grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700 ring-8 ring-white">
          {iconForKind(item.kind)}
        </div>
      </div>

      <div className="min-w-0">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700 sm:hidden">
                {iconForKind(item.kind)}
              </span>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                {item.typeLabel}
              </p>
              <span className={timelineStatusClass(item.status)}>
                {timelineStatusLabel(item.status)}
              </span>
            </div>
            <h4 className="mt-2 text-xl font-black leading-tight text-slate-950">
              {item.title}
            </h4>
            <p className="mt-1 text-sm font-semibold text-slate-700">{item.meta}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
            <div className="flex items-center gap-2 text-sm font-black text-slate-950">
              <Clock className="h-4 w-4 text-slate-500" />
              {item.timeRange}
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Conf. {item.confirmation}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_150px]">
          <div className="min-w-0">
            <div className="flex items-start gap-2 text-sm text-slate-700">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <span className="min-w-0">{item.location}</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {item.details.map((detail) => (
                <span
                  className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
                  key={detail}
                >
                  {detail}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-slate-950 px-4 py-3 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
              Cost
            </p>
            <p className="mt-1 text-lg font-black">{item.costLabel}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
          <Link
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
            href={`/dashboard/trips/${tripId}/map`}
          >
            {item.actionLabel}
          </Link>
          <details className="group min-w-[220px] flex-1">
            <summary className="cursor-pointer list-none rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200">
              Edit details
            </summary>
            <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <TripSegmentForm
                buttonLabel="Save edits"
                defaultEndTime={item.endAt}
                defaultKind={item.kind}
                defaultLat={item.lat}
                defaultLng={item.lng}
                defaultLocation={item.location === "Location not set" ? null : item.location}
                defaultNotes={item.notes}
                defaultStartTime={item.startAt}
                defaultTitle={item.title}
                includeCoordinates
                segmentId={item.id}
                tripId={tripId}
              />
              <TripSegmentDeleteButton segmentId={item.id} />
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}

function DayRoutePreview({
  day,
  tripId
}: {
  day: TripTimelineData["days"][number];
  tripId: string;
}) {
  const mappedItems = day.items.filter((item) => item.lat !== null && item.lng !== null);

  return (
    <Link
      className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-950 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      href={`/dashboard/trips/${tripId}/map`}
    >
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          Day route
        </p>
        <div className="mt-2 flex items-center gap-2 overflow-hidden">
          {day.items.slice(0, 5).map((item, index) => (
            <span className="flex items-center gap-2" key={item.id}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-950 text-xs font-black text-white">
                {index + 1}
              </span>
              {index < Math.min(day.items.length, 5) - 1 ? (
                <span className="h-px w-5 shrink-0 bg-slate-300" />
              ) : null}
            </span>
          ))}
        </div>
        <p className="mt-2 truncate text-sm font-semibold text-slate-600">
          {mappedItems.length ? `${mappedItems.length} mapped stop${mappedItems.length === 1 ? "" : "s"}` : "Add coordinates to preview the route"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:min-w-[170px]">
        <span className="rounded-xl bg-slate-100 px-3 py-2 font-bold text-slate-700">
          {formatDistance(day.routeSummary.totalDistanceMeters)}
        </span>
        <span className="rounded-xl bg-slate-100 px-3 py-2 font-bold text-slate-700">
          {formatDuration(day.routeSummary.estimatedDurationMinutes)}
        </span>
      </div>
    </Link>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function TripOpsSummary({
  mappedStops,
  readyItems,
  totalItems,
  watchItems
}: {
  mappedStops: number;
  readyItems: number;
  totalItems: number;
  watchItems: number;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-black">Trip readiness</h3>
      <div className="mt-4 grid gap-3">
        <SummaryRow
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Confirmed plans"
          value={`${readyItems} of ${totalItems}`}
        />
        <SummaryRow
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Needs attention"
          value={`${watchItems} items`}
        />
        <SummaryRow
          icon={<Route className="h-4 w-4" />}
          label="Mapped stops"
          value={`${mappedStops} pins`}
        />
      </div>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
      <div className="flex min-w-0 items-center gap-2 font-semibold text-slate-700">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <strong className="shrink-0 text-slate-950">{value}</strong>
    </div>
  );
}

function formatDistance(value: number) {
  if (!value) return "Route TBD";
  if (value < 1000) return `${Math.round(value)} m`;
  return `${Math.round(value / 1000)} km`;
}

function formatDuration(value: number) {
  if (!value) return "Time TBD";
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function iconForKind(kind: TimelineItemView["kind"]) {
  switch (kind) {
    case "dinner":
      return <Utensils className="h-5 w-5" />;
    case "expense":
      return <ReceiptText className="h-5 w-5" />;
    case "flight":
      return <Plane className="h-5 w-5" />;
    case "hotel":
      return <Hotel className="h-5 w-5" />;
    case "meeting":
      return <CalendarCheck className="h-5 w-5" />;
    default:
      return exhaustive(kind);
  }
}

function exhaustive(value: never): never {
  throw new Error(`Unhandled timeline item kind: ${String(value)}`);
}
