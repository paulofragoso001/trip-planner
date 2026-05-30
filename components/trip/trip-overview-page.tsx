import type { TripOverviewData } from "@/app/dashboard/trips/[tripId]/overview-loader";

type TripOverviewPageProps = TripOverviewData;

export default function TripOverviewPage({
  actualLabel,
  destination,
  error,
  notes,
  plannedLabel,
  remainingLabel,
  segmentCount,
  status,
  title
}: TripOverviewPageProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <section className="grid gap-4">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Overview</h2>
          {error ? (
            <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {error}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-slate-600">
            {title} is currently {status.toLowerCase()} for {destination}.
          </p>
          {notes ? <p className="mt-3 text-sm text-slate-600">{notes}</p> : null}
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-black">Next steps</h3>
          <div className="mt-4 grid gap-3">
            {[
              `${segmentCount} place${segmentCount === 1 ? "" : "s"} loaded`,
              "Review ideas before adding more places",
              "Share the trip when collaborators are ready"
            ].map((item) => (
              <div
                className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
                key={item}
              >
                {item}
              </div>
            ))}
          </div>
        </article>
      </section>

      <aside className="grid gap-4">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-black">Budget snapshot</h3>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Planned</span>
              <strong>{plannedLabel}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Actual</span>
              <strong>{actualLabel}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Remaining</span>
              <strong>{remainingLabel}</strong>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-black">Trip summary</h3>
          <p className="mt-2 text-sm text-slate-600">
            Itinerary, map, ideas, budget, and sharing stay connected to this trip.
          </p>
        </article>
      </aside>
    </div>
  );
}
