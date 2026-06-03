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
    <div className="grid gap-5" data-testid="trip-overview-page">
      {error ? (
        <p className="rounded-3xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          Some trip details are unavailable, but you can still open your itinerary, map, and ideas.
        </p>
      ) : null}

      <section className="rounded-[2rem] border border-slate-200 bg-white/92 p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
              Trip organizer
            </p>
            <h2 className="mt-2 text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-3xl">
              Your trip at a glance
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              Next up, itinerary, route, expenses, documents, and guests for {title}.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-100"
              href={`${base}/timeline#new-plan`}
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Add trip detail
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-black text-slate-950 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
              href={`${base}/sharing`}
            >
              <Users className="mr-2 h-4 w-4" aria-hidden="true" />
              Share
            </Link>
          </div>
        </div>
      </section>

      <section aria-label="Organizer actions" className="grid grid-cols-4 gap-2 rounded-[2rem] border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-7">
        <QuickAction href={`${base}/timeline#new-plan`} icon={<Plus className="h-5 w-5" />} label="Add Place" />
        <QuickAction disabled icon={<Plane className="h-5 w-5" />} label="Flights" />
        <QuickAction href={`${base}/timeline#new-plan`} icon={<BedDouble className="h-5 w-5" />} label="Lodging" />
        <QuickAction href={`${base}/map`} icon={<MapPin className="h-5 w-5" />} label="Places" />
        <QuickAction href={`${base}/documents`} icon={<FileText className="h-5 w-5" />} label="Documents" />
        <QuickAction href={`${base}/budget`} icon={<CircleDollarSign className="h-5 w-5" />} label="Expenses" />
        <QuickAction href={`${base}/sharing`} icon={<Users className="h-5 w-5" />} label="Guests" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="grid gap-4">
          <WalletCard
            actionHref={nextUp ? `${base}/timeline#${nextUp.id}` : "/dashboard/imports"}
            actionLabel={nextUp ? "Open itinerary" : "Plan with AI"}
            eyebrow="Next Up"
            icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
            title={nextUp ? nextUp.title : "No places yet"}
          >
            {nextUp ? (
              <div className="grid gap-2">
                <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-400">
                  {nextUp.typeLabel}
                </p>
                <p className="text-sm font-semibold text-slate-600">
                  {nextUp.timeLabel} · {nextUp.location}
                </p>
                <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                  {status}
                </span>
              </div>
            ) : (
              <p className="text-sm font-semibold leading-6 text-slate-600">
                Add inspiration or create a place to start building {title}.
              </p>
            )}
          </WalletCard>

          <WalletCard
            actionHref={`${base}/timeline`}
            actionLabel="View all days"
            eyebrow="Itinerary"
            icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
            title={`${segmentCount} place${segmentCount === 1 ? "" : "s"}`}
          >
            <div className="grid gap-1">
              {itineraryPreview.length ? (
                itineraryPreview.slice(0, 5).map((item, index) => (
                  <Link
                    className="grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                    href={`${base}/timeline#${item.id}`}
                    key={item.id}
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-blue-700">
                      {iconForPreview(item.typeLabel)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-slate-950">
                        {index + 1}. {item.title}
                      </span>
                      <span className="block truncate text-xs font-semibold text-slate-500">
                        {item.location}
                      </span>
                    </span>
                    <span className="text-xs font-black text-slate-500">{item.timeLabel}</span>
                  </Link>
                ))
              ) : (
                <EmptyInline
                  body="Add inspiration or a place to start building the itinerary."
                  cta="Plan with AI"
                  href="/dashboard/imports"
                />
              )}
            </div>
          </WalletCard>
        </div>

        <aside className="grid gap-4">
          <WalletCard
            actionHref={`${base}/map`}
            actionLabel="Open map"
            eyebrow="Map"
            icon={<Map className="h-5 w-5" aria-hidden="true" />}
            title={routeReady ? "Route ready" : "Route needs locations"}
          >
            <div className="rounded-[1.5rem] bg-[radial-gradient(circle_at_24%_24%,rgba(37,99,235,0.24),transparent_30%),linear-gradient(135deg,#eff6ff,#f8fafc)] p-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-4xl font-black text-slate-950">{mappedCount}</p>
                  <p className="text-sm font-bold text-slate-600">mapped places</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-950">{suggestionsCount}</p>
                  <p className="text-sm font-bold text-slate-600">Nearby Ideas</p>
                </div>
              </div>
              <p className={routeReady ? "mt-4 text-sm font-black text-emerald-700" : "mt-4 text-sm font-black text-amber-700"}>
                {routeReady ? "Your route is ready." : "Confirm locations to complete the route."}
              </p>
            </div>
          </WalletCard>

          <WalletCard
            actionHref={`${base}/budget`}
            actionLabel="Open expenses"
            eyebrow="Expenses"
            icon={<CircleDollarSign className="h-5 w-5" aria-hidden="true" />}
            title={actualLabel}
          >
            <div className="rounded-[1.5rem] bg-slate-950 p-4 text-white">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">Total in USD</p>
              <p className="mt-1 text-3xl font-black">{actualLabel}</p>
              <p className="mt-1 text-xs font-semibold text-white/60">
                Planned {plannedLabel} · Remaining {remainingLabel}
              </p>
            </div>
            <div className="mt-3 grid gap-2">
              {expenseCategories.length ? (
                expenseCategories.map((category) => (
                  <div className="flex min-h-11 items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm" key={category.id}>
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
          </WalletCard>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <WalletCard
              actionHref={`${base}/documents`}
              actionLabel="Open documents"
              eyebrow="Documents"
              icon={<FileText className="h-5 w-5" aria-hidden="true" />}
              title="Keep details together"
            >
              <div className="grid gap-2">
                <DocumentRow label="Confirmations" />
                <DocumentRow label="Screenshots" />
                <DocumentRow label="Notes and links" />
              </div>
            </WalletCard>

            <WalletCard
              actionHref={`${base}/sharing`}
              actionLabel="Manage guests"
              eyebrow="Share"
              icon={<Users className="h-5 w-5" aria-hidden="true" />}
              title="Trip guests"
            >
              <p className="text-sm font-semibold leading-6 text-slate-600">
                Invite travel partners and keep everyone aligned on the same trip pass.
              </p>
            </WalletCard>
          </div>
        </aside>
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
      <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-950 shadow-sm ring-1 ring-slate-200 transition group-hover:bg-blue-50 group-hover:text-blue-700">
        {icon}
      </span>
      <span className="max-w-[4.8rem] text-center text-[0.68rem] font-black leading-tight text-slate-600">
        {label}
      </span>
    </>
  );

  if (disabled || !href) {
    return (
      <button
        className="group grid min-h-[5.6rem] justify-items-center gap-2 rounded-[1.35rem] bg-slate-50 px-2 py-3 opacity-60 ring-1 ring-slate-200"
        disabled
        title="Coming soon"
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      className="group grid min-h-[5.6rem] justify-items-center gap-2 rounded-[1.35rem] bg-slate-50 px-2 py-3 ring-1 ring-slate-200 transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100"
      href={href}
    >
      {content}
    </Link>
  );
}

function WalletCard({
  actionHref,
  actionLabel,
  children,
  eyebrow,
  icon,
  title
}: {
  actionHref: string;
  actionLabel: string;
  children: ReactNode;
  eyebrow: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700">
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{eyebrow}</p>
            <h3 className="mt-1 break-words text-xl font-black leading-tight text-slate-950">{title}</h3>
          </div>
        </div>
        <Link
          className="hidden min-h-10 shrink-0 items-center rounded-full bg-slate-100 px-4 text-xs font-black text-slate-800 transition hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-100 sm:inline-flex"
          href={actionHref}
        >
          {actionLabel}
        </Link>
      </div>
      <div className="mt-4">{children}</div>
      <Link
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-100 sm:hidden"
        href={actionHref}
      >
        {actionLabel}
      </Link>
    </article>
  );
}

function DocumentRow({ label }: { label: string }) {
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200">
        <FileText className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="text-sm font-bold text-slate-700">{label}</span>
    </div>
  );
}

function iconForPreview(typeLabel: string) {
  const normalized = typeLabel.toLowerCase();
  if (/flight|airport|transport/.test(normalized)) return <Plane className="h-4 w-4" aria-hidden="true" />;
  if (/hotel|lodging|stay/.test(normalized)) return <BedDouble className="h-4 w-4" aria-hidden="true" />;
  if (/restaurant|food|dinner|lunch|cafe/.test(normalized)) return <Utensils className="h-4 w-4" aria-hidden="true" />;
  return <MapPin className="h-4 w-4" aria-hidden="true" />;
}

function EmptyInline({
  body,
  cta,
  href
}: {
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-600">
      <p className="font-semibold">{body}</p>
      <Link
        className="mt-3 inline-flex min-h-10 items-center rounded-full bg-blue-600 px-4 text-xs font-black text-white"
        href={href}
      >
        {cta}
      </Link>
    </div>
  );
}
