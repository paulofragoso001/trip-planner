import Link from "next/link";
import { ArrowRight, Compass, Map, Plane, Radar } from "lucide-react";
import type { DashboardData } from "@/app/dashboard/loader";

type DashboardPageProps = DashboardData & {
  view?: string;
};

export default function DashboardPage({
  error,
  metrics,
  recentTrips,
  view
}: DashboardPageProps) {
  if (view === "flight-status") {
    return <FlightStatusDashboard error={error} metrics={metrics} recentTrips={recentTrips} />;
  }

  const importsWaiting = metrics.find((metric) => metric.label === "Imports waiting")?.value ?? "0";

  return (
    <div className="grid gap-6">
      {error ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">
            Wayline
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Turn travel inspiration into organized, route-ready trips.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Start with messy saved posts and notes, then move the approved plan into your trip command center.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Link
            className="group grid min-h-48 content-between rounded-[1.5rem] bg-slate-950 p-5 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-panel"
            href="/dashboard/imports"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600">
              <Compass className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-2xl font-black">Plan with AI</span>
              <span className="mt-2 block max-w-md text-sm leading-6 text-slate-300">
                Import Instagram, TikTok, Pinterest, YouTube links, screenshots, or notes. Wayline extracts places and drafts the route.
              </span>
            </span>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-black">
              Open AI planner
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </Link>

          <Link
            className="group grid min-h-48 content-between rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 text-slate-950 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-panel"
            href="/dashboard/trips"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-blue-700 shadow-sm">
              <Plane className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-2xl font-black">My Trips</span>
              <span className="mt-2 block max-w-md text-sm leading-6 text-slate-600">
                Manage confirmed itineraries, maps, reservations, shared access, budgets, and travel notes in one place.
              </span>
            </span>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-700">
              Open trip planner
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        {metrics.map((metric) => (
          <article
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            key={metric.label}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {metric.label}
            </p>
            <p className="mt-2 text-3xl font-black">{metric.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                Travel Planner
              </p>
              <h2 className="mt-1 text-lg font-black">Upcoming trips</h2>
            </div>
            <Link className="text-sm font-black text-blue-700" href="/dashboard/trips">
              View all
            </Link>
          </div>
          <div className="mt-4 grid gap-3">
            {recentTrips.length ? (
              recentTrips.map((trip) => (
                <Link
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 transition hover:bg-slate-100"
                  href={trip.href}
                  key={trip.id}
                >
                  <div>
                    <p className="font-semibold">{trip.name}</p>
                    <p className="text-sm text-slate-500">{trip.dateRange}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {trip.status}
                  </span>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
                <p className="font-bold text-slate-950">No recent trips.</p>
                <p className="mt-1">Create a trip to populate this dashboard.</p>
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
            Saved Inspiration
          </p>
          <h2 className="mt-1 text-lg font-black">Recently generated plans</h2>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-blue-700 shadow-sm">
                <Map className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="font-black text-slate-950">{importsWaiting} items waiting</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Review AI candidates, promote confirmed places, then generate the trip plan.
                </p>
              </div>
            </div>
          </div>

          <h3 className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-slate-500">
            Quick actions
          </h3>
          <div className="mt-4 grid gap-3">
            <Link
              className="rounded-2xl bg-blue-600 px-4 py-3 text-left font-semibold text-white"
              href="/dashboard/imports"
            >
              Plan with AI
            </Link>
            <Link
              className="rounded-2xl bg-slate-100 px-4 py-3 text-left font-semibold text-slate-800"
              href="/dashboard/trips#new-trip"
            >
              Create trip
            </Link>
            <Link
              className="rounded-2xl bg-slate-100 px-4 py-3 text-left font-semibold text-slate-800"
              href="/dashboard/admin"
            >
              Open admin tools
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}

function FlightStatusDashboard({
  error,
  metrics,
  recentTrips
}: DashboardData) {
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
              Flight monitoring for confirmed trip segments.
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
            Segments
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
          Add flight itinerary items to a confirmed trip, then refresh flight status from the trip timeline. Gate, terminal, delay, and cancellation updates will appear here.
        </p>
      </section>
    </div>
  );
}
