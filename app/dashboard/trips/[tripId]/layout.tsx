import type { ReactNode } from "react";
import { TripPassHero } from "@/components/trip/trip-pass-hero";
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
    <div className="grid gap-4">
      <div data-testid="trip-workspace-layout">
        <TripPassHero trip={trip} tripId={tripId} />
      </div>

      <TripTabs tripId={tripId} />

      <div>{children}</div>
    </div>
  );
}
