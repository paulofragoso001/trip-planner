import Link from "next/link";
import type { DashboardData } from "@/app/dashboard/loader";

type DashboardPageProps = DashboardData;

export default function DashboardPage({
  error,
  metrics,
  recentTrips
}: DashboardPageProps) {
  return (
    <div className="grid gap-6">
      {error ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-5">
        {metrics.map((metric) => (
          <article
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
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
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Recent trips</h2>
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

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Quick actions</h2>
          <div className="mt-4 grid gap-3">
            <Link
              className="rounded-2xl bg-blue-600 px-4 py-3 text-left font-semibold text-white"
              href="/dashboard/trips#new-trip"
            >
              Create trip
            </Link>
            <Link
              className="rounded-2xl bg-slate-100 px-4 py-3 text-left font-semibold text-slate-800"
              href="/dashboard/imports"
            >
              Review imports
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
