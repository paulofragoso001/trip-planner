import type { ReactNode } from "react";
import { ShareTripButton } from "@/components/trip/share-trip-button";
import { TripTabs } from "@/components/trip/trip-tabs";
import { StatusBadge } from "@/components/trip-ui";
import { loadTripWorkspaceData } from "./loader";

type TripLayoutProps = {
  children: ReactNode;
  params: Promise<{ tripId: string }>;
};

export default async function TripLayout({ children, params }: TripLayoutProps) {
  const { tripId } = await params;
  const trip = await loadTripWorkspaceData(tripId);

  return (
    <div className="grid gap-6">
      <section
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        data-testid="trip-workspace-layout"
      >
        <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
          Current trip
        </p>
        <div className="mt-2 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <h2 className="text-3xl font-black tracking-tight text-slate-950">{trip.name}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge tone="blue">{trip.destination}</StatusBadge>
              <StatusBadge>{trip.dateRange}</StatusBadge>
              <StatusBadge tone="purple">{trip.travelStyle}</StatusBadge>
              <StatusBadge tone={trip.mappedStops ? "green" : "slate"}>
                {trip.mappedStops} mapped places
              </StatusBadge>
              <StatusBadge tone={trip.needsLocationStops ? "amber" : "green"}>
                {trip.needsLocationStops} needs location
              </StatusBadge>
              <StatusBadge tone={trip.suggestionsCount ? "blue" : "slate"}>
                {trip.suggestionsCount} nearby ideas
              </StatusBadge>
            </div>
            {trip.error ? (
              <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                {trip.error}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <ShareTripButton tripId={tripId} />
          </div>
        </div>
      </section>

      <TripTabs tripId={tripId} />

      <div>{children}</div>
    </div>
  );
}
