import type { ReactNode } from "react";
import { TripPassShell } from "@/components/trip/trip-pass-shell";
import { loadTripWorkspaceData } from "./loader";

type TripLayoutProps = {
  children: ReactNode;
  params: Promise<{ tripId: string }>;
};

export default async function TripLayout({ children, params }: TripLayoutProps) {
  const { tripId } = await params;
  const trip = await loadTripWorkspaceData(tripId);

  return (
    <TripPassShell trip={trip} tripId={tripId}>
      {children}
    </TripPassShell>
  );
}
