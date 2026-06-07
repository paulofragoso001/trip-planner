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

      <Link
        className="flex min-h-20 items-center justify-between gap-4 rounded-[1.75rem] bg-slate-950 p-4 text-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
        data-testid="mobile-primary-trip-cta"
        href={`${base}/timeline#new-plan`}
      >
        <span className="min-w-0">
          <span className="block text-lg font-black">Add trip item</span>
          <span className="mt-1 block text-xs font-semibold text-white/65">
            Add a place, activity, reservation, or note.
          </span>
        </span>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/12">
          <Plus className="h-5 w-5" aria-hidden="true" />
        </span>
      </Link>

      {nextUp ? (
        <WalletCard
          actionHref={`${base}/timeline#${nextUp.id}`}
          actionLabel="Open itinerary"
          eyebrow="Next Up"
          icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
          title={nextUp.title}
        >
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
        </WalletCard>
      ) : null}

      <WalletCard
        actionHref={`${base}/timeline`}
        actionLabel="View itinerary"
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
              body="Add inspiration or a trip item to start building the itinerary."
              cta="Plan with AI"
              href="/dashboard/imports"
            />
          )}
        </div>
      </WalletCard>

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
              <p className="text-2xl font-black text-slate-950">{segmentCount - mappedCount}</p>
              <p className="text-sm font-bold text-slate-600">need location</p>
            </div>
          </div>
          <p className={routeReady ? "mt-4 text-sm font-black text-emerald-700" : "mt-4 text-sm font-black text-amber-700"}>
            {routeReady ? "Your route is ready." : "Confirm locations to complete the route."}
          </p>
        </div>
      </WalletCard>

      {suggestionsCount > 0 ? (
        <WalletCard
          actionHref={`${base}/ideas`}
          actionLabel="Open Ideas"
          eyebrow="Ideas"
          icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
          title={`${suggestionsCount} nearby idea${suggestionsCount === 1 ? "" : "s"}`}
        >
          <p className="text-sm font-semibold leading-6 text-slate-600">
            Review places and activities near your route.
          </p>
        </WalletCard>
      ) : null}

      <details className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <summary className="cursor-pointer text-base font-black text-slate-950">
          More
        </summary>
        <div className="mt-4 grid gap-2">
          <MoreLink
            href={`${base}/budget`}
            icon={<CircleDollarSign className="h-4 w-4" aria-hidden="true" />}
            label="Expenses"
            meta={`${actualLabel} total · planned ${plannedLabel} · remaining ${remainingLabel}`}
          />
          {expenseCategories.slice(0, 3).map((category) => (
            <div className="flex min-h-10 items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm" key={category.id}>
              <span className="font-bold text-slate-700">{category.label}</span>
              <strong>{category.amountLabel}</strong>
            </div>
          ))}
          <MoreLink
            href={`${base}/documents`}
            icon={<FileText className="h-4 w-4" aria-hidden="true" />}
            label="Documents"
            meta="Confirmations, screenshots, notes, and links."
          />
          <MoreLink
            href={`${base}/sharing`}
            icon={<Users className="h-4 w-4" aria-hidden="true" />}
            label="Share"
            meta="Invite trip guests."
          />
        </div>
      </details>
    </div>
  );
}

function MoreLink({
  href,
  icon,
  label,
  meta
}: {
  href: string;
  icon: ReactNode;
  label: string;
  meta: string;
}) {
  return (
    <Link
      className="grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-100"
      href={href}
    >
      <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-blue-700 ring-1 ring-slate-200">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-slate-950">{label}</span>
        <span className="block truncate text-xs font-semibold text-slate-500">{meta}</span>
      </span>
      <span className="text-xs font-black text-blue-700">Open</span>
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
