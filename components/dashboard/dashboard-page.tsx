import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  Compass,
  Map as MapIcon,
  Plane,
  Radar,
  Sparkles
} from "lucide-react";
import type { DashboardData } from "@/app/dashboard/loader";
import { tripUi } from "@/components/trip-ui";
import { WalletActionLink, WalletCard } from "@/components/wallet/wallet-card";
import { WalletPageShell } from "@/components/wallet/wallet-page-shell";

type DashboardPageProps = DashboardData & {
  view?: string;
};

export default function DashboardPage({
  error,
  heroImage,
  metrics,
  recentTrips,
  view
}: DashboardPageProps) {
  if (view === "alerts") {
    return <NotificationsDashboard error={error} heroImage={heroImage} />;
  }

  if (view === "flight-status") {
    return <FlightStatusDashboard error={error} metrics={metrics} recentTrips={recentTrips} />;
  }

  const importsWaiting =
    metrics.find((metric) => metric.label === "Ideas waiting")?.value ??
    metrics.find((metric) => metric.label === "Imports waiting")?.value ??
    "0";
  const ideasWaitingCount = Number.parseInt(importsWaiting.replace(/[^\d]/g, ""), 10) || 0;
  const latestTrip = recentTrips[0] || null;
  const remainingTrips = recentTrips.slice(1, 4);
  const primaryHeroHref = latestTrip ? latestTrip.href : "/dashboard/trips#new-trip";
  const primaryHeroLabel = latestTrip ? "Continue trip" : "Create your first trip";

  return (
    <WalletPageShell
      actions={
        <>
          <WalletActionLink data-testid="home-primary-cta" href={primaryHeroHref}>
            {primaryHeroLabel}
          </WalletActionLink>
          <WalletActionLink
            className="bg-white text-slate-950 hover:bg-slate-100"
            href="/dashboard/imports"
          >
            Start planning
          </WalletActionLink>
        </>
      }
      compactHero
      eyebrow="WAYLINE"
      fallbackGradient={heroImage.fallbackGradient}
      heroImage={heroImage}
      subtitle="Pick up a trip, start planning, or review ideas waiting for you."
      title="Your travel companion"
    >
      <div className="mx-auto grid w-full max-w-4xl gap-4 sm:gap-5">
        {latestTrip ? (
          <Link
            className="group relative isolate grid min-h-[12rem] content-between overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-2xl transition hover:-translate-y-0.5 sm:min-h-[14rem] sm:p-6"
            href={latestTrip.href}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.24),transparent_30%),linear-gradient(135deg,#020617,#1d4ed8_54%,#0f766e)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.04),rgba(2,6,23,0.78))]" />
            <div className="relative flex items-start justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/62">
                Latest trip
              </p>
              <span className={tripUi.card.walletGlass}>{latestTrip.status}</span>
            </div>
            <div className="relative">
              <h2 className="max-w-2xl break-words text-2xl font-black leading-[0.98] tracking-tight sm:text-4xl">
                {latestTrip.name}
              </h2>
              <p className="mt-3 text-sm font-bold text-white/72">{latestTrip.dateRange}</p>
              <span className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-slate-950">
                Continue
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 transition group-hover:translate-x-1"
                />
              </span>
            </div>
          </Link>
        ) : (
          <WalletCard
            action={
              <WalletActionLink href="/dashboard/trips#new-trip">Create trip</WalletActionLink>
            }
            eyebrow="Travel pass"
            title="Create your first trip"
            variant="utility"
          >
            <p className="text-sm font-semibold leading-6 text-slate-600">
              Choose a destination and start building your travel pass.
            </p>
          </WalletCard>
        )}

        <WalletAction
          href="/dashboard/imports"
          icon={<Compass aria-hidden="true" className="h-5 w-5" />}
          label="Start with an idea"
          meta="Paste a note, link, or screenshot. Wayline will find places for you to review."
          cta="Add idea"
        />

        {ideasWaitingCount > 0 ? (
          <WalletAction
            href="/dashboard/imports#ai-review"
            icon={<Sparkles aria-hidden="true" className="h-5 w-5" />}
            label="Ready for review"
            meta="Review places Wayline found before adding them to a trip."
            cta="Review places"
          />
        ) : null}

      {remainingTrips.length ? (
        <WalletCard
          action={
            <Link className="text-sm font-black text-blue-700" href="/dashboard/trips">
              View all trips
            </Link>
          }
          eyebrow="Travel wallet"
          title="Recent trips"
          variant="utility"
        >
          <div className="grid gap-3">
            {remainingTrips.map((trip) => (
              <Link
                className="group grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                href={trip.href}
                key={trip.id}
              >
                <span className="min-w-0">
                  <span className={tripUi.text.micro}>{trip.status}</span>
                  <span className="mt-1 block truncate text-lg font-black text-slate-950">
                    {trip.name}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-slate-500">
                    {trip.dateRange}
                  </span>
                </span>
                <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </WalletCard>
      ) : null}
      </div>
    </WalletPageShell>
  );
}

function WalletAction({
  href,
  icon,
  cta,
  label,
  meta
}: {
  href: string;
  icon: ReactNode;
  cta: string;
  label: string;
  meta: string;
}) {
  return (
    <Link
      className="group grid min-h-24 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
      href={href}
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-black text-slate-950">{label}</span>
        <span className="mt-1 block text-sm font-semibold text-slate-500">{meta}</span>
        <span className="mt-3 inline-flex min-h-11 items-center rounded-full bg-slate-950 px-4 text-sm font-black text-white sm:hidden">
          {cta}
        </span>
      </span>
      <ArrowRight
        aria-hidden="true"
        className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-700"
      />
    </Link>
  );
}

function FlightStatusDashboard({
  error,
  metrics,
  recentTrips
}: Pick<DashboardData, "error" | "metrics" | "recentTrips">) {
  const segments = metrics.find((metric) => metric.label === "Segments")?.value ?? "0";

  return (
    <div className="grid gap-6" data-testid="flight-status-dashboard">
      {error ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {error}
        </p>
      ) : null}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={tripUi.text.eyebrow}>Flight Status</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Flight monitoring for confirmed trip places.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Flight updates appear here after flight segments are added to a trip and refreshed.
              Non-flight trip ideas stay in the itinerary and map workspace.
            </p>
          </div>
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700">
            <Radar aria-hidden="true" className="h-6 w-6" />
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <FlightMetric label="Trips watched" value={recentTrips.length} />
        <FlightMetric label="Places" value={segments} />
        <FlightMetric
          label="Alerts"
          value={metrics.find((metric) => metric.label === "Alerts")?.value ?? "0"}
        />
      </section>

      <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-5 shadow-sm sm:p-6">
        <p className="font-black text-slate-950">No live flight updates to review.</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Add flight places to a confirmed trip, then refresh flight status from the itinerary.
          Gate, terminal, delay, and cancellation updates will appear here.
        </p>
      </section>
    </div>
  );
}

function NotificationsDashboard({
  error,
  heroImage
}: Pick<DashboardData, "error" | "heroImage">) {
  return (
    <WalletPageShell
      actions={<WalletActionLink href="/dashboard">Back home</WalletActionLink>}
      compactHero
      eyebrow="UPDATES"
      fallbackGradient={heroImage.fallbackGradient}
      heroImage={heroImage}
      subtitle="Trip updates and shared activity will appear here."
      title="Notifications"
    >
      <div className="grid gap-4">
        {error ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Some details are unavailable, but you can still plan or open your trips.
          </p>
        ) : null}
        <WalletCard
          eyebrow="Wayline"
          icon={<Bell aria-hidden="true" className="h-5 w-5" />}
          title="No notifications yet"
          variant="utility"
        >
          <p className="text-sm font-semibold leading-6 text-slate-600">
            Important trip updates and guest activity will show up here when there is something to review.
          </p>
        </WalletCard>
      </div>
    </WalletPageShell>
  );
}

function FlightMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </article>
  );
}
