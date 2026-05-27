"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { TripButton, TripCard } from "@/components/trip-ui";

export type TripShellTab =
  | "overview"
  | "timeline"
  | "map"
  | "budget"
  | "activity"
  | "sharing";

export type TripShellTrip = {
  actualSpend: number;
  destination: string;
  endDate: string;
  id: string;
  name: string;
  plannedBudget: number;
  startDate: string;
};

type TripShellContextValue = {
  activeTab: TripShellTab;
  setActiveTab: (tab: TripShellTab) => void;
  trip: TripShellTrip;
};

const TripShellContext = createContext<TripShellContextValue | null>(null);

type TripShellProps = {
  activityRail?: ReactNode;
  children: ReactNode;
  header?: ReactNode;
  tabs?: ReactNode;
  testId?: string;
  trip?: TripShellTrip;
};

const demoTrip: TripShellTrip = {
  actualSpend: 3870,
  destination: "Barcelona, Spain",
  endDate: "Jun 17, 2026",
  id: "trip_1",
  name: "Barcelona Work Trip",
  plannedBudget: 4200,
  startDate: "Jun 11, 2026"
};

export function useTripShell() {
  const context = useContext(TripShellContext);

  if (!context) {
    throw new Error("useTripShell must be used within TripShell");
  }

  return context;
}

export function TripShell({
  activityRail,
  children,
  header,
  tabs,
  testId = "trip-shell",
  trip = demoTrip
}: TripShellProps) {
  const [activeTab, setActiveTab] = useState<TripShellTab>("overview");
  const contextValue = useMemo(
    () => ({ activeTab, setActiveTab, trip }),
    [activeTab, trip]
  );

  return (
    <TripShellContext.Provider value={contextValue}>
      <TripCard as="section" className="p-5" data-testid={testId}>
        <div className="grid gap-5">
          {header ?? <DemoTripHeader trip={trip} />}
          {tabs}
          {activityRail ? (
            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">{children}</div>
              <aside aria-label="Trip activity rail" className="min-w-0">
                {activityRail}
              </aside>
            </div>
          ) : (
            children
          )}
        </div>
      </TripCard>
    </TripShellContext.Provider>
  );
}

function DemoTripHeader({ trip }: { trip: TripShellTrip }) {
  const status = getBudgetStatus(trip.actualSpend, trip.plannedBudget);

  return (
    <header className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Trip detail
        </p>
        <h1 className="mt-1 text-xl font-black sm:text-2xl">{trip.name}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {trip.destination} - {trip.startDate} to {trip.endDate}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${status.tone}`}>
          {status.label}
        </span>
        <TripButton variant="secondary">Share</TripButton>
        <TripButton variant="primaryCompact">+ Expense</TripButton>
        <TripButton className="bg-slate-900 hover:bg-slate-800" variant="primaryCompact">
          + Plan
        </TripButton>
      </div>
    </header>
  );
}

function getBudgetStatus(actual: number, planned: number) {
  const ratio = planned > 0 ? actual / planned : 0;

  if (ratio > 1) {
    return {
      label: "Over budget",
      tone: "bg-red-100 text-red-700 border-red-200"
    };
  }

  if (ratio > 0.9) {
    return {
      label: "Near limit",
      tone: "bg-amber-100 text-amber-700 border-amber-200"
    };
  }

  return {
    label: "On track",
    tone: "bg-emerald-100 text-emerald-700 border-emerald-200"
  };
}
