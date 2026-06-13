import Link from "next/link";
import { BedDouble, Car, CircleDollarSign, Martini, MoreHorizontal, Plane, Plus, ReceiptText, Utensils, X } from "lucide-react";
import type { ReactNode } from "react";
import type { TripBudgetData } from "@/app/dashboard/trips/[tripId]/budget/types";
import { BudgetRecordForm } from "@/components/trip/budget-record-form";

type TripBudgetPageProps = TripBudgetData;

export default function TripBudgetPage({
  actualLabel,
  alerts,
  categories,
  destination,
  error,
  latestRecords,
  plannedLabel,
  remainingLabel,
  title,
  tripId
}: TripBudgetPageProps) {
  const base = `/dashboard/trips/${encodeURIComponent(tripId)}`;

  return (
    <div
      className="min-h-[100svh] bg-[#05070f] px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 text-white lg:min-h-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0"
      data-testid="trip-budget-page"
    >
      <section className="mx-auto grid max-w-xl gap-5 lg:max-w-none lg:grid-cols-[1fr_0.8fr]">
        <div className="lg:hidden">
          <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/42" aria-hidden="true" />
          <div className="grid grid-cols-[1fr_auto_auto] items-start gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white/48">{destination}</p>
              <h1 className="text-3xl font-black tracking-tight text-white">My Spending</h1>
            </div>
            <button
              aria-label="More spending options"
              className="grid h-11 w-11 place-items-center rounded-full bg-white/12 text-white/76"
              type="button"
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            </button>
            <Link
              aria-label="Close spending"
              className="grid h-11 w-11 place-items-center rounded-full bg-white/12 text-white/76"
              href={base}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <section className="grid gap-5">
          <article className="hidden overflow-hidden rounded-[1.75rem] bg-slate-950 text-white shadow-sm lg:block">
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

          <article className="rounded-[1.55rem] bg-[#1c1c1f] text-white shadow-[0_18px_50px_rgba(0,0,0,0.24)] ring-1 ring-white/8 lg:rounded-[1.75rem] lg:p-1">
            <div className="hidden items-center justify-between gap-3 p-4 lg:flex">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/42">{title}</p>
                <h2 className="text-lg font-black text-white">My Spending</h2>
              </div>
              <CircleDollarSign className="h-5 w-5 text-orange-300" aria-hidden="true" />
            </div>

            {categories.length ? (
              <div className="grid gap-5 p-4">
                {categories.map((category) => (
                  <section className="grid gap-2" key={category.id}>
                    <div className="flex items-center gap-2 text-[0.7rem] font-black uppercase tracking-[0.12em] text-white/44">
                      <span className={iconBubbleClass(category.category, "tiny")}>
                        {iconForCategory(category.category, "tiny")}
                      </span>
                      <span>{category.label}</span>
                    </div>
                    <div className="overflow-hidden rounded-lg bg-white/[0.08]">
                      {(category.records.length ? category.records : [{ amountLabel: category.amountLabel, id: `${category.id}-summary`, label: category.label }]).map((record) => (
                        <div
                          className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 last:border-b-0"
                          key={record.id}
                        >
                          <span className="min-w-0 truncate text-sm font-semibold text-white/86">{record.label}</span>
                          <span className="text-right text-sm font-semibold text-white/54">{record.amountLabel}</span>
                        </div>
                      ))}
                      <div className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-3 border-t border-white/[0.08] px-3 py-2.5">
                        <span className="text-sm font-black text-white">Total</span>
                        <strong className="text-right text-sm text-white">{category.amountLabel}</strong>
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="p-4">
                <div className="rounded-xl border border-dashed border-white/12 px-4 py-5 text-sm text-white/62">
                  <p className="font-black text-white">No expenses yet</p>
                  <p className="mt-1 font-semibold">Add an expense to track trip spending.</p>
                </div>
              </div>
            )}

            <div className="sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom))] grid grid-cols-[1fr_auto] items-center border-t border-white/[0.08] bg-[#1c1c1f]/96 px-4 py-4 backdrop-blur-xl lg:static lg:bottom-auto">
              <span className="text-2xl font-black text-white/48">Total</span>
              <strong className="text-3xl font-black tracking-tight text-white">{actualLabel}</strong>
            </div>
          </article>
        </section>

        <section className="grid gap-5">
          {latestRecords.length ? (
            <article className="rounded-[1.55rem] bg-[#1c1c1f] p-4 text-white ring-1 ring-white/8">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-black">Latest Added</h2>
                <ReceiptText className="h-5 w-5 text-white/42" aria-hidden="true" />
              </div>
              <div className="mt-3 overflow-hidden rounded-lg bg-white/[0.06]">
                {latestRecords.map((record) => (
                  <div className="grid min-h-12 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 last:border-b-0" key={record.id}>
                    <span className={iconBubbleClass(record.category)}>
                      {iconForCategory(record.category)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white/88">{record.label}</span>
                      <span className="text-xs font-semibold text-white/38">{record.recordType}</span>
                    </span>
                    <strong className="text-sm text-white/64">{record.amountLabel}</strong>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          <section className="rounded-[1.55rem] bg-[#1c1c1f] p-4 shadow-sm ring-1 ring-white/8 lg:bg-white lg:text-slate-950 lg:ring-slate-200">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-orange-500/18 text-orange-300 lg:bg-blue-600 lg:text-white">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-black text-white lg:text-slate-950">Add expense</h3>
              <p className="text-sm font-semibold text-white/46 lg:text-slate-500">Track a cost for this trip.</p>
            </div>
          </div>
          <BudgetRecordForm tripId={tripId} />
        </section>

        <section className="rounded-[1.55rem] bg-[#1c1c1f] p-4 shadow-sm ring-1 ring-white/8 lg:bg-white lg:text-slate-950 lg:ring-slate-200">
          <h3 className="text-base font-black text-white lg:text-slate-950">Expense notes</h3>
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
        </section>
      </section>
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

function iconForCategory(category: string, size: "normal" | "tiny" = "normal"): ReactNode {
  const className = size === "tiny" ? "h-3.5 w-3.5" : "h-4 w-4";
  const normalized = category.toLowerCase();
  if (normalized.includes("flight")) return <Plane className={className} aria-hidden="true" />;
  if (normalized.includes("lodging") || normalized.includes("hotel")) return <BedDouble className={className} aria-hidden="true" />;
  if (normalized.includes("food") || normalized.includes("restaurant")) return <Utensils className={className} aria-hidden="true" />;
  if (normalized.includes("bar") || normalized.includes("party")) return <Martini className={className} aria-hidden="true" />;
  if (normalized.includes("ground") || normalized.includes("transport")) return <Car className={className} aria-hidden="true" />;
  return <CircleDollarSign className={className} aria-hidden="true" />;
}

function iconBubbleClass(category: string, size: "normal" | "tiny" = "normal") {
  const normalized = category.toLowerCase();
  const base = size === "tiny"
    ? "grid h-5 w-5 shrink-0 place-items-center rounded-full"
    : "grid h-8 w-8 shrink-0 place-items-center rounded-full";
  if (normalized.includes("flight")) return `${base} bg-sky-500/18 text-sky-300`;
  if (normalized.includes("lodging") || normalized.includes("hotel")) return `${base} bg-purple-500/18 text-purple-300`;
  if (normalized.includes("food") || normalized.includes("restaurant")) return `${base} bg-orange-500/18 text-orange-300`;
  if (normalized.includes("bar") || normalized.includes("party")) return `${base} bg-amber-500/18 text-amber-300`;
  if (normalized.includes("ground") || normalized.includes("transport")) return `${base} bg-blue-500/18 text-blue-300`;
  return `${base} bg-emerald-500/18 text-emerald-300`;
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
