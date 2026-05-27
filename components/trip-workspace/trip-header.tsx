"use client";

import { useTripShell } from "./trip-shell";

type TripHeaderProps = {
  onShare?: () => void;
};

export function TripHeader({ onShare }: TripHeaderProps = {}) {
  const { trip, setActiveTab } = useTripShell();
  const remaining = trip.plannedBudget - trip.actualSpend;
  const ratio = trip.plannedBudget > 0 ? trip.actualSpend / trip.plannedBudget : 0;
  const status =
    ratio > 1 ? "Over budget" : ratio > 0.9 ? "Near limit" : "On track";
  const tone =
    ratio > 1
      ? "bg-red-100 text-red-700 border-red-200"
      : ratio > 0.9
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-emerald-100 text-emerald-700 border-emerald-200";

  return (
    <section
      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="trip-execution-header"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Trip detail
          </p>
          <h1 className="text-2xl font-black sm:text-3xl">{trip.name}</h1>
          <p className="text-sm text-slate-600">
            {trip.destination} - {trip.startDate} to {trip.endDate}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${tone}`}>
            {status}
          </span>
          <button
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            onClick={() => {
              setActiveTab("sharing");
              onShare?.();
            }}
            type="button"
          >
            Share
          </button>
          <button
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            onClick={() => setActiveTab("budget")}
            type="button"
          >
            + Expense
          </button>
          <button
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={() => setActiveTab("timeline")}
            type="button"
          >
            + Plan
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Planned
          </p>
          <p className="mt-1 text-xl font-black">
            ${trip.plannedBudget.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Actual
          </p>
          <p className="mt-1 text-xl font-black">
            ${trip.actualSpend.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Remaining
          </p>
          <p className="mt-1 text-xl font-black">${remaining.toLocaleString()}</p>
        </div>
      </div>
    </section>
  );
}
