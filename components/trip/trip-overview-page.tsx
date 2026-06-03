import Link from "next/link";
import {
  BedDouble,
  CircleDollarSign,
  FileText,
  Map,
  MapPin,
  Plane,
  Plus,
  Sparkles,
  Users
} from "lucide-react";
import type { ReactNode } from "react";
import type { TripOverviewData } from "@/app/dashboard/trips/[tripId]/overview-loader";

type TripOverviewPageProps = TripOverviewData;

export default function TripOverviewPage({
  actualLabel,
  destination,
  error,
  expenseCategories,
  itineraryPreview,
  mappedCount,
  nextUp,
  plannedLabel,
  remainingLabel,
  segmentCount,
  suggestionsCount,
  title,
  tripId
}: TripOverviewPageProps) {
  const base = `/dashboard/trips/${encodeURIComponent(tripId)}`;

  return (
    <div className="grid gap-5">
      {error ? (
        <p className="rounded-3xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          {error}
        </p>
      ) : null}

      <section className="grid gap-3 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
              Trip organizer
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Everything for this trip</h2>
          </div>
          <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
            {mappedCount}/{segmentCount} mapped
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          <QuickAction href={`${base}/timeline`} icon={<Plus className="h-5 w-5" />} label="Add" />
          <QuickAction disabled icon={<Plane className="h-5 w-5" />} label="Flights" />
          <QuickAction href={`${base}/timeline`} icon={<BedDouble className="h-5 w-5" />} label="Lodging" />
          <QuickAction href={`${base}/map`} icon={<MapPin className="h-5 w-5" />} label="Places" />
          <QuickAction href={`${base}/documents`} icon={<FileText className="h-5 w-5" />} label="Docs" />
          <QuickAction href={`${base}/budget`} icon={<CircleDollarSign className="h-5 w-5" />} label="Expenses" />
          <QuickAction href={`${base}/sharing`} icon={<Users className="h-5 w-5" />} label="Guests" />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="grid gap-5">
          <article className="overflow-hidden rounded-[1.75rem] bg-slate-950 text-white shadow-sm">
            <div className="bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.28),transparent_34%),linear-gradient(135deg,#020617,#172554)] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">
                Next up
              </p>
              {nextUp ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <p className="text-3xl font-black leading-none">{nextUp.timeLabel}</p>
                    <h3 className="mt-3 text-2xl font-black">{nextUp.title}</h3>
                    <p className="mt-2 text-sm font-semibold text-white/70">
                      {nextUp.typeLabel} · {nextUp.location}
                    </p>
                  </div>
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 text-sm font-black text-slate-950"
                    href={`${base}/timeline#${nextUp.id}`}
                  >
                    Open itinerary
                  </Link>
                </div>
              ) : (
                <div className="mt-5">
                  <h3 className="text-2xl font-black">No places yet</h3>
                  <p className="mt-2 text-sm font-semibold text-white/70">
                    Add inspiration or a place to start building {title}.
                  </p>
                  <Link
                    className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 text-sm font-black text-slate-950"
                    href="/dashboard/imports"
                  >
                    Plan with AI
                  </Link>
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-950">Itinerary preview</h3>
                <p className="text-sm font-semibold text-slate-500">{destination}</p>
              </div>
              <Link className="text-sm font-black text-blue-700" href={`${base}/timeline`}>
                View all days
              </Link>
            </div>
            <div className="mt-4 grid gap-2">
              {itineraryPreview.length ? (
                itineraryPreview.map((item) => (
                  <Link
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3 transition hover:bg-slate-100"
                    href={`${base}/timeline#${item.id}`}
                    key={item.id}
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-blue-700">
                      <MapPin className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-slate-950">{item.title}</span>
                      <span className="block truncate text-xs font-semibold text-slate-500">
                        {item.timeLabel} · {item.typeLabel}
                      </span>
                    </span>
                    <span className={item.isMapped ? "text-xs font-black text-emerald-700" : "text-xs font-black text-amber-700"}>
                      {item.isMapped ? "Mapped" : "Needs location"}
                    </span>
                  </Link>
                ))
              ) : (
                <EmptyCard
                  body="Add inspiration or create a place to start building the itinerary."
                  cta="Plan with AI"
                  href="/dashboard/imports"
                  title="No itinerary yet"
                />
              )}
            </div>
          </article>
        </section>

        <aside className="grid gap-5">
          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-950">Map preview</h3>
                <p className="text-sm font-semibold text-slate-500">
                  {mappedCount} mapped place{mappedCount === 1 ? "" : "s"}
                </p>
              </div>
              <Map className="h-5 w-5 text-blue-600" aria-hidden="true" />
            </div>
            <div className="mt-4 rounded-[1.5rem] bg-[radial-gradient(circle_at_25%_25%,rgba(37,99,235,0.28),transparent_30%),linear-gradient(135deg,#e0f2fe,#eff6ff)] p-4">
              <p className="text-3xl font-black text-slate-950">{segmentCount}</p>
              <p className="text-sm font-bold text-slate-600">places in this trip</p>
              <p className="mt-3 text-sm font-semibold text-slate-700">
                {suggestionsCount} nearby idea{suggestionsCount === 1 ? "" : "s"} ready
              </p>
              <Link
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-black text-white"
                href={`${base}/map`}
              >
                Open map
              </Link>
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Expenses</h3>
            <div className="mt-3 rounded-[1.5rem] bg-slate-950 p-4 text-white">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">Total in USD</p>
              <p className="mt-1 text-3xl font-black">{actualLabel}</p>
              <p className="mt-1 text-xs font-semibold text-white/60">
                Planned {plannedLabel} · Remaining {remainingLabel}
              </p>
            </div>
            <div className="mt-3 grid gap-2">
              {expenseCategories.length ? (
                expenseCategories.map((category) => (
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm" key={category.id}>
                    <span className="font-bold text-slate-700">{category.label}</span>
                    <strong>{category.amountLabel}</strong>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-600">
                  Track flights, lodging, food, and activities for this trip.
                </p>
              )}
            </div>
            <Link className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-blue-600 px-4 text-sm font-black text-white" href={`${base}/budget`}>
              Open expenses
            </Link>
          </article>

          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-orange-100 text-orange-700">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-lg font-black text-slate-950">Documents</h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Keep confirmations, screenshots, notes, and links for this trip in one place.
                </p>
              </div>
            </div>
            <Link className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-100 px-4 text-sm font-black text-slate-800" href={`${base}/documents`}>
              Open documents
            </Link>
          </article>
        </aside>
      </div>
    </div>
  );
}

function QuickAction({
  disabled,
  href,
  icon,
  label
}: {
  disabled?: boolean;
  href?: string;
  icon: ReactNode;
  label: string;
}) {
  const content = (
    <>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-800">
        {icon}
      </span>
      <span className="text-[0.72rem] font-black text-slate-700">{label}</span>
    </>
  );

  if (disabled || !href) {
    return (
      <button
        className="grid min-h-[5.25rem] justify-items-center gap-2 rounded-2xl bg-slate-50 px-2 py-3 opacity-60"
        disabled
        title="Coming soon"
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <Link className="grid min-h-[5.25rem] justify-items-center gap-2 rounded-2xl bg-slate-50 px-2 py-3 transition hover:bg-slate-100" href={href}>
      {content}
    </Link>
  );
}

function EmptyCard({
  body,
  cta,
  href,
  title
}: {
  body: string;
  cta: string;
  href: string;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 text-blue-600" aria-hidden="true" />
        <div>
          <p className="font-black text-slate-950">{title}</p>
          <p className="mt-1 font-semibold">{body}</p>
          <Link className="mt-3 inline-flex min-h-10 items-center rounded-full bg-blue-600 px-4 text-xs font-black text-white" href={href}>
            {cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
