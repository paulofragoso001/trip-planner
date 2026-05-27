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
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Timeline
            </h2>
            <p className="mt-1 text-2xl font-black text-slate-950">{title}</p>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:min-w-[300px]">
            <StatPill label="Items" value={String(stats.totalItems)} />
            <StatPill label="Ready" value={`${stats.readyItems}/${stats.totalItems}`} />
            <StatPill label="Alerts" value={String(stats.alerts)} />
          </div>
        </div>

        {error ? (
          <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {error}
          </p>
        ) : null}

        {dayTabs.length ? (
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Trip days">
            {dayTabs.map((day, index) => (
              <a
                className={[
                  "min-w-[116px] rounded-2xl border px-4 py-3 text-left transition",
                  index === 0
                    ? "border-blue-600 bg-blue-600 text-white shadow-sm"
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
        ) : null}

        <div className="mt-6 grid gap-7">
          {days.length ? (
            days.map((day) => (
            <section className="grid gap-4" id={day.id} key={day.id}>
              <div className="flex items-center gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
                  <span className="text-xs font-bold uppercase">{day.label}</span>
                  <span className="-mt-1 text-lg font-black">{day.dayNumber}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-slate-950">{day.date}</h3>
                  <p className="text-sm text-slate-600">{day.summary}</p>
                </div>
              </div>

              <div className="relative grid gap-4 pl-3 sm:pl-7">
                <div className="absolute bottom-6 left-[17px] top-2 hidden w-px bg-slate-200 sm:block" />
                {day.items.map((item) => (
                  <TimelineCard item={item} key={item.id} tripId={tripId} />
                ))}
              </div>
            </section>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 px-5 py-8 text-sm text-slate-600">
              <p className="font-bold text-slate-950">No timeline segments yet.</p>
              <p className="mt-1">Add flights, hotels, meetings, or activities to build the trip timeline.</p>
            </div>
          )}
        </div>
      </section>

      <aside className="grid gap-4">
        <TimelineTools firstFlight={firstFlight} tripId={tripId} timelineItemIds={days.flatMap((day) => day.items.map((item) => item.id))} />
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
      <h3 className="text-base font-black">Timeline tools</h3>
      <p className="mt-2 text-sm text-slate-600">
        Keep itinerary changes synced across flights, maps, budget, and calendars.
      </p>
      <div className="mt-4 grid gap-3">
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
          Add segment
        </Link>
        <div id="new-plan">
          <TripSegmentForm buttonLabel="Add segment" tripId={tripId} />
        </div>
      </div>
    </div>
  );
}

function TimelineCard({ item, tripId }: { item: TimelineItemView; tripId: string }) {
  return (
    <article className="relative rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="absolute -left-[35px] top-5 hidden h-6 w-6 rounded-full border-4 border-white bg-blue-600 shadow-sm sm:block" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
            {iconForKind(item.kind)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {item.typeLabel}
              </p>
              <span className={timelineStatusClass(item.status)}>
                {timelineStatusLabel(item.status)}
              </span>
            </div>
            <h4 className="mt-1 text-xl font-black text-slate-950">{item.title}</h4>
            <p className="mt-1 text-sm font-semibold text-slate-700">{item.meta}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-left lg:min-w-[180px]">
          <div className="flex items-center gap-2 text-sm font-black text-slate-950">
            <Clock className="h-4 w-4 text-slate-500" />
            {item.timeRange}
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Conf. {item.confirmation}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px]">
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <div className="flex items-start gap-2 text-sm text-slate-700">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <span>{item.location}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.details.map((detail) => (
              <span
                className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
                key={detail}
              >
                {detail}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">
              Cost
            </p>
            <p className="mt-1 text-lg font-black">{item.costLabel}</p>
          </div>
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
      </div>
    </article>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
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
