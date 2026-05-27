import type { ReactNode } from "react";
import { ShareTripButton } from "@/components/trip/share-trip-button";
import { TripTabs } from "@/components/trip/trip-tabs";
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Trip workspace
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">{trip.name}</h2>
            <p className="text-sm text-slate-600">
              {trip.destination} - {trip.dateRange}
            </p>
            {trip.error ? (
              <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                {trip.error}
              </p>
            ) : null}
          </div>
          <ShareTripButton tripId={tripId} />
        </div>
      </section>

      <TripTabs tripId={tripId} />

      <div>{children}</div>
    </div>
  );
}
