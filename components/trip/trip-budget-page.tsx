import { BedDouble, Car, CircleDollarSign, Martini, Plane, Plus, ReceiptText, Utensils } from "lucide-react";
import type { ReactNode } from "react";
import type { TripBudgetData } from "@/app/dashboard/trips/[tripId]/budget/types";
import { BudgetRecordForm } from "@/components/trip/budget-record-form";

type TripBudgetPageProps = TripBudgetData;

export default function TripBudgetPage({
  actualLabel,
  alerts,
  categories,
  error,
  latestRecords,
  plannedLabel,
  remainingLabel,
  tripId
}: TripBudgetPageProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="grid gap-5">
        <article className="overflow-hidden rounded-[1.75rem] bg-slate-950 text-white shadow-sm">
          <div className="bg-[radial-gradient(circle_at_20%_0%,rgba(249,115,22,0.34),transparent_30%),linear-gradient(135deg,#020617,#172554)] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">
              Expenses
            </p>
            <p className="mt-5 text-sm font-bold text-white/60">Total in USD</p>
            <h2 className="mt-1 text-5xl font-black tracking-tight">{actualLabel}</h2>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label="Planned" value={plannedLabel} />
              <Metric label="Remaining" value={remainingLabel} />
              <Metric label="Categories" value={`${categories.length}`} />
            </div>
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">Category breakdown</h2>
              <p className="text-sm font-semibold text-slate-500">Flights, lodging, food, and activities.</p>
            </div>
            <CircleDollarSign className="h-5 w-5 text-blue-600" aria-hidden="true" />
          </div>
          <div className="mt-4 grid gap-3">
            {categories.length ? (
              categories.map((category) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                  key={category.id}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-slate-700">
                      {iconForCategory(category.category)}
                    </span>
                    <span className="truncate font-black text-slate-800">{category.label}</span>
                  </span>
                  <strong>{category.amountLabel}</strong>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
                <p className="font-black text-slate-950">No expenses yet.</p>
                <p className="mt-1 font-semibold">Track flights, lodging, food, and activities for this trip.</p>
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-slate-950">Latest added</h2>
            <ReceiptText className="h-5 w-5 text-slate-500" aria-hidden="true" />
          </div>
          <div className="mt-4 grid gap-3">
            {latestRecords.length ? (
              latestRecords.map((record) => (
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3" key={record.id}>
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-slate-700">
                      {iconForCategory(record.category)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-slate-900">{record.label}</span>
                      <span className="text-xs font-semibold text-slate-500">{record.recordType}</span>
                    </span>
                  </span>
                  <strong className="shrink-0">{record.amountLabel}</strong>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600">
                New expense records will appear here.
              </p>
            )}
          </div>
        </article>
      </section>

      <aside className="grid gap-5">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-white">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-950">Add expense</h3>
              <p className="text-sm font-semibold text-slate-500">Track a cost for this trip.</p>
            </div>
          </div>
          <BudgetRecordForm tripId={tripId} />
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-base font-black text-slate-950">Expense notes</h3>
          {error ? (
            <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
              {error}
            </p>
          ) : null}
          <div className="mt-4 grid gap-3 text-sm font-semibold">
            {alerts.map((alert) => (
              <p className={`rounded-2xl px-4 py-3 ${alertToneClass(alert.tone)}`} key={alert.id}>
                {alert.message}
              </p>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/12 px-3 py-3 ring-1 ring-white/10">
      <p className="text-lg font-black">{value}</p>
      <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/55">{label}</p>
    </div>
  );
}

function iconForCategory(category: string): ReactNode {
  const normalized = category.toLowerCase();
  if (normalized.includes("flight")) return <Plane className="h-5 w-5" aria-hidden="true" />;
  if (normalized.includes("lodging") || normalized.includes("hotel")) return <BedDouble className="h-5 w-5" aria-hidden="true" />;
  if (normalized.includes("food") || normalized.includes("restaurant")) return <Utensils className="h-5 w-5" aria-hidden="true" />;
  if (normalized.includes("bar") || normalized.includes("party")) return <Martini className="h-5 w-5" aria-hidden="true" />;
  if (normalized.includes("ground") || normalized.includes("transport")) return <Car className="h-5 w-5" aria-hidden="true" />;
  return <CircleDollarSign className="h-5 w-5" aria-hidden="true" />;
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
