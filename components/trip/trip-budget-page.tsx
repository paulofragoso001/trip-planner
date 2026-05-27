import type { TripBudgetData } from "@/app/dashboard/trips/[tripId]/budget/types";
import { BudgetRecordForm } from "@/components/trip/budget-record-form";

type TripBudgetPageProps = TripBudgetData;

export default function TripBudgetPage({
  actualLabel,
  alerts,
  categories,
  error,
  plannedLabel,
  remainingLabel,
  tripId
}: TripBudgetPageProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Budget</h2>
        {error ? (
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {error}
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["Planned", plannedLabel],
            ["Actual", actualLabel],
            ["Remaining", remainingLabel]
          ].map(([label, value]) => (
            <div className="rounded-2xl bg-slate-50 px-4 py-3" key={label}>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-lg font-black">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3">
          {categories.length ? (
            categories.map((category) => (
            <div
              className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
              key={category.id}
            >
              <span className="font-medium">{category.label}</span>
              <strong>{category.amountLabel}</strong>
            </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
              <p className="font-bold text-slate-950">No budget records yet.</p>
              <p className="mt-1">Add planned or actual costs to track this trip.</p>
            </div>
          )}
        </div>
      </section>

      <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-black">Budget alerts</h3>
        <BudgetRecordForm tripId={tripId} />
        <div className="mt-4 grid gap-3 text-sm text-slate-700">
          {alerts.map((alert) => (
            <p className={`rounded-2xl px-4 py-3 ${alertToneClass(alert.tone)}`} key={alert.id}>
              {alert.message}
            </p>
          ))}
        </div>
      </aside>
    </div>
  );
}

function alertToneClass(tone: TripBudgetData["alerts"][number]["tone"]) {
  switch (tone) {
    case "danger":
      return "bg-red-50 text-red-700";
    case "good":
      return "bg-emerald-50 text-emerald-700";
    case "warning":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-50 text-slate-700";
  }
}
