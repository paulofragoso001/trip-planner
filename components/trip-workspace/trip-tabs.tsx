"use client";

import { useTripShell, type TripShellTab } from "./trip-shell";

export type TripTabItem = {
  badge?: string;
  id: TripShellTab;
  label: string;
};

const defaultTabs: TripTabItem[] = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Itinerary" },
  { id: "map", label: "Map" },
  { id: "budget", label: "Budget" },
  { id: "activity", label: "Activity" },
  { id: "sharing", label: "Sharing" }
];

type TripTabsProps = {
  items?: TripTabItem[];
};

export function TripTabs({ items }: TripTabsProps = {}) {
  const { activeTab, setActiveTab } = useTripShell();
  const tabs = items ?? defaultTabs;

  return (
    <div
      className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm"
      data-testid="trip-tabs"
    >
      <div className="hidden gap-2 lg:flex">
        {tabs.map((tab) => (
          <button
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.id ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
            {tab.badge ? <span className="ml-2 opacity-80">{tab.badge}</span> : null}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 lg:hidden">
        {tabs.map((tab) => (
          <button
            className={`rounded-2xl px-3 py-3 text-xs font-semibold transition ${
              activeTab === tab.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
            }`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
            {tab.badge ? <span className="ml-1 opacity-80">{tab.badge}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
