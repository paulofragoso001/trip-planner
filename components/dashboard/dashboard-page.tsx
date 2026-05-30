import Link from "next/link";
import { ArrowRight, Compass, Plane, Radar } from "lucide-react";
import type { DashboardData } from "@/app/dashboard/loader";
import { FirstRunOnboarding } from "@/components/dashboard/first-run-onboarding";
import { PageHeader, SectionCard } from "@/components/trip-ui";

type DashboardPageProps = DashboardData & {
  view?: string;
};

export default function DashboardPage({
  error,
  firstRun,
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

  return (
    <div className="grid gap-6">
      {error ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {error}
        </p>
      ) : null}

      <PageHeader
        actions={
          <>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700"
              href="/dashboard/imports"
            >
              Start planning
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-800 transition hover:bg-slate-200"
              href="/dashboard/trips"
            >
              View trips
            </Link>
          </>
        }
        subtitle="Pick up an existing trip or start from a saved idea."
        title="Where do you want to start?"
      />

      <FirstRunOnboarding firstRun={firstRun} />

      <section className="grid gap-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Link
            className="group grid min-h-32 content-between rounded-[1.5rem] bg-slate-950 p-4 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-panel sm:min-h-40 sm:p-5"
            href="/dashboard/imports"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600">
              <Compass className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <h2 className="text-xl font-black sm:text-2xl">Plan a trip</h2>
              <span className="mt-2 block max-w-md text-sm leading-6 text-slate-300">
                Add inspiration and let Wayline find places.
              </span>
            </span>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-black">
              Start planning
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </Link>

          <Link
            className="group grid min-h-32 content-between rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-slate-950 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-panel sm:min-h-40 sm:p-5"
            href="/dashboard/trips"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-blue-700 shadow-sm">
              <Plane className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <h2 className="text-xl font-black sm:text-2xl">Open my trips</h2>
              <span className="mt-2 block max-w-md text-sm leading-6 text-slate-600">
                Continue an itinerary or view your map.
              </span>
            </span>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-700">
              View trips
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </section>

      {recentTrips.length || importsWaiting !== "0" ? (
      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {recentTrips.length ? (
        <SectionCard
          actions={
            <Link className="text-sm font-black text-blue-700" href="/dashboard/trips">
              View all
            </Link>
          }
          eyebrow="My Trips"
          title="Continue planning"
        >
          <div className="mt-4 grid gap-3">
            {recentTrips.map((trip) => (
                <Link
                className="grid gap-2 rounded-2xl bg-slate-50 px-4 py-3 transition hover:bg-slate-100 sm:flex sm:items-center sm:justify-between sm:gap-4"
                  href={trip.href}
                  key={trip.id}
                >
                  <div>
                    <p className="font-semibold">{trip.name}</p>
                    <p className="text-sm text-slate-500">{trip.dateRange}</p>
                  </div>
                  <span className="w-fit shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {trip.status}
                  </span>
                </Link>
            ))}
          </div>
        </SectionCard>
        ) : null}

        {importsWaiting !== "0" ? (
        <SectionCard eyebrow="Ideas" title="Ready for review">
          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <div>
                <p className="font-black text-slate-950">
                  {importsWaiting} item{importsWaiting === "1" ? "" : "s"} waiting
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Review waiting places when you are ready.
                </p>
              </div>
            </div>
          </div>
          <Link
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-black text-white"
            href="/dashboard/imports#ai-review"
          >
            Review places
          </Link>
        </SectionCard>
        ) : null}
      </section>
      ) : null}
    </div>
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
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">
              Flight Status
            </p>
            <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Flight monitoring for confirmed trip places.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Flight updates appear here after flight segments are added to a trip and refreshed. Non-flight trip ideas stay in the itinerary and map workspace.
            </p>
          </div>
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700">
            <Radar className="h-6 w-6" aria-hidden="true" />
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Trips watched
          </p>
          <p className="mt-2 text-3xl font-black">{recentTrips.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Places
          </p>
          <p className="mt-2 text-3xl font-black">{segments}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Alerts
          </p>
          <p className="mt-2 text-3xl font-black">
            {metrics.find((metric) => metric.label === "Alerts")?.value ?? "0"}
          </p>
        </article>
      </section>

      <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-5 shadow-sm sm:p-6">
        <p className="font-black text-slate-950">No live flight updates to review.</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Add flight places to a confirmed trip, then refresh flight status from the itinerary. Gate, terminal, delay, and cancellation updates will appear here.
        </p>
      </section>
    </div>
  );
}
