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
      className="rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm sm:rounded-3xl sm:p-4"
      data-testid="trip-execution-header"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Trip detail
          </p>
          <h1 className="break-words text-2xl font-black sm:text-3xl">{trip.name}</h1>
          <p className="break-words text-sm text-slate-600">
            {trip.destination} - {trip.startDate} to {trip.endDate}
          </p>
        </div>

        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
          <span className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-bold ${tone}`}>
            {status}
          </span>
          <button
            className="min-h-11 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold hover:bg-slate-50"
            onClick={() => {
              setActiveTab("sharing");
              onShare?.();
            }}
            type="button"
          >
            Share
          </button>
          <button
            className="min-h-11 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            onClick={() => setActiveTab("budget")}
            type="button"
          >
            + Expense
          </button>
          <button
            className="min-h-11 rounded-full bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={() => setActiveTab("timeline")}
            type="button"
          >
            + Plan
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-2xl bg-slate-50 p-3 sm:p-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-xs sm:tracking-[0.2em]">
            Planned
          </p>
          <p className="mt-1 text-base font-black sm:text-xl">
            ${trip.plannedBudget.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 sm:p-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-xs sm:tracking-[0.2em]">
            Actual
          </p>
          <p className="mt-1 text-base font-black sm:text-xl">
            ${trip.actualSpend.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 sm:p-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-xs sm:tracking-[0.2em]">
            Remaining
          </p>
          <p className="mt-1 text-base font-black sm:text-xl">${remaining.toLocaleString()}</p>
        </div>
      </div>
    </section>
  );
}
