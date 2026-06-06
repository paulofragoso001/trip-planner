import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Compass,
  Map as MapIcon,
  Plane,
  Radar,
  Sparkles
} from "lucide-react";
import type { DashboardData } from "@/app/dashboard/loader";
import { FirstRunOnboarding } from "@/components/dashboard/first-run-onboarding";
import { tripUi } from "@/components/trip-ui";
import { WalletActionLink, WalletCard } from "@/components/wallet/wallet-card";
import { WalletPageShell } from "@/components/wallet/wallet-page-shell";

type DashboardPageProps = DashboardData & {
  view?: string;
};

export default function DashboardPage({
  error,
  firstRun,
  heroImage,
  metrics,
  recentTrips,
  view
}: DashboardPageProps) {
  if (view === "flight-status") {
    return <FlightStatusDashboard error={error} metrics={metrics} recentTrips={recentTrips} />;
  }

  const importsWaiting =
    metrics.find((metric) => metric.label === "Ideas waiting")?.value ??
    metrics.find((metric) => metric.label === "Imports waiting")?.value ??
    "0";
  const latestTrip = recentTrips[0] || null;
  const remainingTrips = recentTrips.slice(1, 4);

  return (
    <WalletPageShell
      actions={
        <>
          <WalletActionLink href="/dashboard/imports">Start planning</WalletActionLink>
          <WalletActionLink className="bg-white text-slate-950 hover:bg-slate-100" href="/dashboard/trips">
            View trips
          </WalletActionLink>
        </>
      }
      compactHero
      eyebrow="WAYLINE"
      fallbackGradient={heroImage.fallbackGradient}
      heroImage={heroImage}
      subtitle="Pick up a trip or start from a saved idea."
      title="Your travel companion"
    >
      <div className="grid gap-5">
        {error ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Some details are unavailable, but you can still plan or open your trips.
          </p>
        ) : null}

        <FirstRunOnboarding firstRun={firstRun} />

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        {latestTrip ? (
          <Link
            className="group relative isolate grid min-h-[18rem] content-between overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-2xl transition hover:-translate-y-0.5 sm:min-h-[22rem] sm:p-6"
            href={latestTrip.href}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.24),transparent_30%),linear-gradient(135deg,#020617,#1d4ed8_54%,#0f766e)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.04),rgba(2,6,23,0.78))]" />
            <div className="relative flex items-start justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/62">
                Continue trip pass
              </p>
              <span className={tripUi.card.walletGlass}>{latestTrip.status}</span>
            </div>
            <div className="relative">
              <h2 className="max-w-xl text-4xl font-black leading-none tracking-tight sm:text-5xl">
                {latestTrip.name}
              </h2>
              <p className="mt-3 text-sm font-bold text-white/72">{latestTrip.dateRange}</p>
              <span className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-slate-950">
                Continue trip
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 transition group-hover:translate-x-1"
                />
              </span>
            </div>
          </Link>
        ) : (
          <Link
            className="group relative isolate grid min-h-[18rem] content-between overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-2xl transition hover:-translate-y-0.5 sm:min-h-[22rem] sm:p-6"
            href="/dashboard/trips#new-trip"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.22),transparent_34%),linear-gradient(135deg,#020617,#172554_52%,#0f766e)]" />
            <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/62">
                New Trip Pass
              </p>
            </div>
            <div className="relative">
              <h2 className="max-w-xl text-4xl font-black leading-none tracking-tight sm:text-5xl">
                Start your next trip
              </h2>
              <p className="mt-3 max-w-sm text-sm font-bold leading-6 text-white/72">
                Create a pass, add ideas, then build the itinerary and map.
              </p>
              <span className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-slate-950">
                Create your first trip
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 transition group-hover:translate-x-1"
                />
              </span>
            </div>
          </Link>
        )}

        <div className="grid gap-3">
          <WalletAction
            href="/dashboard/trips#new-trip"
            icon={<Plane aria-hidden="true" className="h-5 w-5" />}
            label="Create trip"
            meta="Choose a destination and dates."
          />
          <WalletAction
            href="/dashboard/imports"
            icon={<Compass aria-hidden="true" className="h-5 w-5" />}
            label="Start planning"
            meta="Paste a note, link, or screenshot."
          />
          <WalletAction
            href={importsWaiting !== "0" ? "/dashboard/imports#ai-review" : "/dashboard/trips"}
            icon={
              importsWaiting !== "0" ? (
                <Sparkles aria-hidden="true" className="h-5 w-5" />
              ) : (
                <MapIcon aria-hidden="true" className="h-5 w-5" />
              )
            }
            label={importsWaiting !== "0" ? "Review ideas" : "Open trips"}
            meta={
              importsWaiting !== "0"
                ? `${importsWaiting} waiting to review.`
                : "Continue itinerary or map."
            }
          />
        </div>
      </section>

      {remainingTrips.length ? (
        <WalletCard
          action={
            <Link className="text-sm font-black text-blue-700" href="/dashboard/trips">
              View all
            </Link>
          }
          eyebrow="Trip passes"
          title="Recent passes"
          variant="utility"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {remainingTrips.map((trip) => (
              <Link
                className="group rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                href={trip.href}
                key={trip.id}
              >
                <p className={tripUi.text.micro}>Trip Pass</p>
                <h3 className="mt-2 truncate text-lg font-black text-slate-950">{trip.name}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">{trip.dateRange}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-blue-700">
                  Open pass
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 transition group-hover:translate-x-1"
                  />
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
      className="group grid min-h-24 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
      href={href}
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-black text-slate-950">{label}</span>
        <span className="mt-1 block text-sm font-semibold text-slate-500">{meta}</span>
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

function FlightMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </article>
  );
}
