import Link from "next/link";
import {
  BedDouble,
  CalendarDays,
  CircleDollarSign,
  FileText,
  Map,
  MapPin,
  Plane,
  Plus,
  Search,
  Sparkles,
  Utensils,
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
  status,
  suggestionsCount,
  title,
  tripId
}: TripOverviewPageProps) {
  const base = `/dashboard/trips/${encodeURIComponent(tripId)}`;
  const routeReady = mappedCount > 0 && mappedCount === segmentCount;

  return (
    <div className="grid gap-5">
      {error ? (
        <p className="rounded-3xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl ring-1 ring-black/10">
        <div className="bg-[radial-gradient(circle_at_16%_0%,rgba(249,115,22,0.28),transparent_30%),radial-gradient(circle_at_88%_10%,rgba(59,130,246,0.24),transparent_32%),linear-gradient(145deg,#020617,#111827_56%,#1f2937)] p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">
                Trip organizer
              </p>
              <h2 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">Everything for this trip</h2>
              <p className="mt-1 truncate text-sm font-semibold text-white/62">{destination}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                aria-label="Search trip"
                className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/10 backdrop-blur"
                href={`${base}/documents`}
              >
                <Search className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link
                aria-label="Add to itinerary"
                className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-950"
                href={`${base}/timeline#new-plan`}
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-7">
            <QuickAction href={`${base}/timeline#new-plan`} icon={<Plus className="h-5 w-5" />} label="New activity" />
            <QuickAction disabled icon={<Plane className="h-5 w-5" />} label="Flights" />
            <QuickAction href={`${base}/timeline#new-plan`} icon={<BedDouble className="h-5 w-5" />} label="Lodging" />
            <QuickAction href={`${base}/map`} icon={<MapPin className="h-5 w-5" />} label="Places" />
            <QuickAction href={`${base}/documents`} icon={<FileText className="h-5 w-5" />} label="Documents" />
            <QuickAction href={`${base}/budget`} icon={<CircleDollarSign className="h-5 w-5" />} label="Expenses" />
            <QuickAction href={`${base}/sharing`} icon={<Users className="h-5 w-5" />} label="Guests" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <section className="grid gap-4">
              <article className="rounded-[1.75rem] bg-black/36 p-4 ring-1 ring-white/10 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-300">Next up</p>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/72">
                    {status}
                  </span>
                </div>
                {nextUp ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white/55">{nextUp.typeLabel}</p>
                      <h3 className="mt-1 break-words text-2xl font-black">{nextUp.title}</h3>
                      <p className="mt-2 text-sm font-semibold text-white/62">
                        {nextUp.timeLabel} · {nextUp.location}
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
                  <div className="mt-4">
                    <h3 className="text-2xl font-black">No places yet</h3>
                    <p className="mt-2 text-sm font-semibold text-white/62">
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
              </article>

              <article className="rounded-[1.75rem] bg-black/34 p-4 ring-1 ring-white/10 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-orange-500/18 text-orange-300">
                      <CalendarDays className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-lg font-black">Itinerary preview</h3>
                      <p className="text-sm font-semibold text-white/52">
                        {segmentCount} place{segmentCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <Link className="text-sm font-black text-orange-300" href={`${base}/timeline`}>
                    View all days
                  </Link>
                </div>
                <div className="mt-4 grid gap-1">
                  {itineraryPreview.length ? (
                    itineraryPreview.slice(0, 5).map((item, index) => (
                      <Link
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl px-2.5 py-2.5 transition hover:bg-white/8"
                        href={`${base}/timeline#${item.id}`}
                        key={item.id}
                      >
                        <span className="relative grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white">
                          {iconForPreview(item.typeLabel)}
                          {index < Math.min(itineraryPreview.length, 5) - 1 ? (
                            <span className="absolute left-1/2 top-full h-4 w-px -translate-x-1/2 bg-white/14" aria-hidden="true" />
                          ) : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black text-white">{item.title}</span>
                          <span className="block truncate text-xs font-semibold text-white/46">
                            {item.location}
                          </span>
                        </span>
                        <span className="text-xs font-black text-white/58">{item.timeLabel}</span>
                      </Link>
                    ))
                  ) : (
                    <EmptyCard
                      body="Add inspiration or create a place to start building the itinerary."
                      cta="Plan with AI"
                      href="/dashboard/imports"
                      title="No itinerary yet"
                      tone="dark"
                    />
                  )}
                </div>
              </article>
            </section>

            <aside className="grid gap-4">
              <article className="rounded-[1.75rem] bg-white p-4 text-slate-950 shadow-2xl shadow-black/20">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black">Map preview</h3>
                    <p className="text-sm font-semibold text-slate-500">
                      {mappedCount}/{segmentCount} mapped
                    </p>
                  </div>
                  <Map className="h-5 w-5 text-blue-600" aria-hidden="true" />
                </div>
                <div className="mt-4 rounded-[1.5rem] bg-[radial-gradient(circle_at_24%_26%,rgba(59,130,246,0.24),transparent_30%),linear-gradient(135deg,#dbeafe,#f8fafc)] p-4">
                  <p className="text-3xl font-black">{segmentCount}</p>
                  <p className="text-sm font-bold text-slate-600">places in this trip</p>
                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    {suggestionsCount} nearby idea{suggestionsCount === 1 ? "" : "s"} ready
                  </p>
                  <p className={routeReady ? "mt-3 text-sm font-black text-emerald-700" : "mt-3 text-sm font-black text-amber-700"}>
                    {routeReady ? "Route ready" : "Needs location"}
                  </p>
                  <Link
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-black text-white"
                    href={`${base}/map`}
                  >
                    Open map
                  </Link>
                </div>
              </article>

              <article className="rounded-[1.75rem] bg-white p-4 text-slate-950 shadow-2xl shadow-black/20">
                <h3 className="text-lg font-black">Expenses</h3>
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

              <article className="rounded-[1.75rem] bg-white p-4 text-slate-950 shadow-2xl shadow-black/20">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-orange-100 text-orange-700">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-lg font-black">Documents</h3>
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
      </section>
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
      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/10 transition group-hover:bg-white/16">
        {icon}
      </span>
      <span className="max-w-[4.8rem] text-center text-[0.68rem] font-black leading-tight text-white/64">{label}</span>
    </>
  );

  if (disabled || !href) {
    return (
      <button
        className="group grid min-h-[5.7rem] justify-items-center gap-2 rounded-2xl bg-white/[0.045] px-2 py-3 opacity-60 ring-1 ring-white/6"
        disabled
        title="Coming soon"
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <Link className="group grid min-h-[5.7rem] justify-items-center gap-2 rounded-2xl bg-white/[0.045] px-2 py-3 ring-1 ring-white/6 transition hover:bg-white/[0.075]" href={href}>
      {content}
    </Link>
  );
}

function iconForPreview(typeLabel: string) {
  const normalized = typeLabel.toLowerCase();
  if (/flight|airport|transport/.test(normalized)) return <Plane className="h-4 w-4" aria-hidden="true" />;
  if (/hotel|lodging|stay/.test(normalized)) return <BedDouble className="h-4 w-4" aria-hidden="true" />;
  if (/restaurant|food|dinner|lunch|cafe/.test(normalized)) return <Utensils className="h-4 w-4" aria-hidden="true" />;
  return <MapPin className="h-4 w-4" aria-hidden="true" />;
}

function EmptyCard({
  body,
  cta,
  href,
  title,
  tone = "light"
}: {
  body: string;
  cta: string;
  href: string;
  title: string;
  tone?: "dark" | "light";
}) {
  const dark = tone === "dark";

  return (
    <div
      className={[
        "rounded-2xl border border-dashed px-4 py-6 text-sm",
        dark ? "border-white/14 text-white/62" : "border-slate-300 text-slate-600"
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <Sparkles className={dark ? "mt-0.5 h-5 w-5 text-orange-300" : "mt-0.5 h-5 w-5 text-blue-600"} aria-hidden="true" />
        <div>
          <p className={dark ? "font-black text-white" : "font-black text-slate-950"}>{title}</p>
          <p className="mt-1 font-semibold">{body}</p>
          <Link
            className={[
              "mt-3 inline-flex min-h-10 items-center rounded-full px-4 text-xs font-black",
              dark ? "bg-white text-slate-950" : "bg-blue-600 text-white"
            ].join(" ")}
            href={href}
          >
            {cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
