import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  MapPin,
  Radar,
  Sparkles
} from "lucide-react";
import type { DashboardData } from "@/app/dashboard/loader";
import { HomeSmartStart } from "@/components/dashboard/home-smart-start";
import { MobileHomeWallet } from "@/components/dashboard/mobile-home-wallet";
import { tripUi } from "@/components/trip-ui";
import { WalletActionLink, WalletCard } from "@/components/wallet/wallet-card";
import { WalletPageShell } from "@/components/wallet/wallet-page-shell";
import { dashboardActionRoutes } from "@/lib/dashboard/action-routes";

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
  const primaryHeroHref = latestTrip ? latestTrip.href : dashboardActionRoutes.trips.create;
  const primaryHeroLabel = latestTrip ? "Continue trip" : "Create your first trip";
  const heroImageUrl = heroImage.imageUrl || null;
  const heroImageAlt = heroImage.imageAlt || "Wayline travel pass background";

  return (
    <>
      <MobileHomeWallet
        initialSheetState={view === "trips" ? "expanded" : "collapsed"}
        metrics={metrics}
        recentTrips={recentTrips}
      />
      <div
        className="mx-auto hidden w-full max-w-5xl gap-4 pb-4 sm:gap-5 lg:grid lg:pb-4"
        data-testid="home-launch-page"
      >
      <section
        className="relative isolate overflow-visible rounded-[2rem] border border-white/10 bg-slate-950 p-4 text-white shadow-[0_28px_90px_rgba(2,6,23,0.28)] sm:rounded-[2.25rem] sm:p-6 lg:p-7"
        data-testid="home-hero"
      >
        {heroImageUrl ? (
          <img
            alt={heroImageAlt}
            className="absolute inset-0 -z-10 h-full w-full rounded-[inherit] object-cover"
            loading="lazy"
            src={heroImageUrl}
          />
        ) : (
          <div className={`absolute inset-0 -z-10 rounded-[inherit] ${heroImage.fallbackGradient}`} />
        )}
        <div className="absolute inset-0 -z-10 rounded-[inherit] bg-[radial-gradient(circle_at_16%_4%,rgba(255,255,255,0.22),transparent_28%),linear-gradient(135deg,rgba(2,6,23,0.38),rgba(2,6,23,0.91)_62%,rgba(2,6,23,0.96))]" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-white/64">Wayline</p>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 text-sm font-black text-slate-950 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-white/30"
              data-testid="home-primary-cta"
              href={primaryHeroHref}
            >
              {primaryHeroLabel}
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/18 bg-white/10 px-4 text-sm font-black text-white backdrop-blur transition hover:bg-white/16 focus:outline-none focus:ring-4 focus:ring-white/20"
              href={dashboardActionRoutes.plan.addIdea}
            >
              Start planning
            </Link>
          </div>
        </div>

        <div className="mt-14 max-w-3xl sm:mt-16">
          <h1 className="break-words text-4xl font-black leading-[0.94] tracking-tight sm:text-6xl lg:text-7xl">
            Your travel companion
          </h1>
          <p className="mt-4 max-w-2xl text-base font-bold leading-7 text-white/78 sm:text-lg">
            Pick up a trip, start planning, or review ideas waiting for you.
          </p>
        </div>

        <HomeSmartStart />
      </section>

      <div className="grid gap-3" data-testid="home-card-stack">
        {latestTrip ? (
          <Link
            className="group grid min-h-28 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[1.75rem] border border-white/70 bg-white/94 p-4 text-slate-950 shadow-[0_18px_50px_rgba(15,23,42,0.08)] ring-1 ring-slate-950/5 transition hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.12)] sm:p-5"
            data-testid="latest-trip-pass"
            href={latestTrip.href}
          >
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
                  Latest trip
                </span>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                  {latestTrip.status}
                </span>
              </span>
              <span className="mt-2 block break-words text-xl font-black leading-tight sm:text-2xl">
                {latestTrip.name}
              </span>
              <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm font-bold text-slate-500">
                <span>{latestTrip.destination}</span>
                <span>{latestTrip.dateRange}</span>
              </span>
            </span>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-950 text-white transition group-hover:bg-blue-600">
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </span>
          </Link>
        ) : (
          <HomeRow
            cta="Create trip"
            href={dashboardActionRoutes.trips.create}
            icon={<MapPin aria-hidden="true" className="h-5 w-5" />}
            label="Create your first trip"
            meta="Choose a destination and start building your travel pass."
            tone="dark"
          />
        )}

        <HomeRow
          cta="Add idea"
          href={dashboardActionRoutes.plan.addIdea}
          icon={<Sparkles aria-hidden="true" className="h-5 w-5" />}
          label="Start with an idea"
          meta="Paste a note, link, or screenshot. Wayline will find places for you to review."
        />

        {ideasWaitingCount > 0 ? (
          <HomeRow
            cta="Review places"
            href={dashboardActionRoutes.plan.reviewPlaces}
            icon={<Sparkles aria-hidden="true" className="h-5 w-5" />}
            label="Ready for review"
            meta={`${ideasWaitingCount} idea${ideasWaitingCount === 1 ? "" : "s"} waiting to become places.`}
          />
        ) : null}

        {remainingTrips.length ? (
          <section className="rounded-[1.75rem] border border-white/70 bg-white/94 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] ring-1 ring-slate-950/5 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-black text-slate-950">Recent trips</h2>
              <Link className="text-sm font-black text-blue-700" href={dashboardActionRoutes.trips.list}>
                View all trips
              </Link>
            </div>
            <div className="mt-3 grid gap-2">
              {remainingTrips.map((trip) => (
                <Link
                  className="group grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 transition hover:bg-blue-50"
                  href={trip.href}
                  key={trip.id}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-slate-950">
                      {trip.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-bold text-slate-500">
                      {trip.destination} · {trip.dateRange}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-700"
                  />
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
      </div>
    </>
  );
}

function HomeRow({
  cta,
  href,
  icon,
  label,
  meta,
  tone = "light"
}: {
  cta: string;
  href: string;
  icon: ReactNode;
  label: string;
  meta: string;
  tone?: "dark" | "light";
}) {
  return (
    <Link
      className={
        tone === "dark"
          ? "group grid min-h-24 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.75rem] bg-slate-950 p-4 text-white shadow-[0_18px_50px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 sm:p-5"
          : "group grid min-h-24 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.75rem] border border-white/70 bg-white/94 p-4 text-slate-950 shadow-[0_18px_50px_rgba(15,23,42,0.08)] ring-1 ring-slate-950/5 transition hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.12)] sm:p-5"
      }
      href={href}
    >
      <span
        className={
          tone === "dark"
            ? "grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/12 text-white"
            : "grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700"
        }
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-black">{label}</span>
        <span
          className={
            tone === "dark"
              ? "mt-1 block text-sm font-semibold leading-5 text-white/66"
              : "mt-1 block text-sm font-semibold leading-5 text-slate-500"
          }
        >
          {meta}
        </span>
        <span
          className={
            tone === "dark"
              ? "mt-3 inline-flex min-h-10 items-center rounded-full bg-white px-4 text-sm font-black text-slate-950 sm:hidden"
              : "mt-3 inline-flex min-h-10 items-center rounded-full bg-slate-950 px-4 text-sm font-black text-white sm:hidden"
          }
        >
          {cta}
        </span>
      </span>
      <ArrowRight
        aria-hidden="true"
        className={
          tone === "dark"
            ? "h-4 w-4 text-white/54 transition group-hover:translate-x-1 group-hover:text-white"
            : "h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-700"
        }
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
