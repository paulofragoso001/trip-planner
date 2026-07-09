"use client";

import { useMemo, useState } from "react";
import { MobileTripsCountriesMap } from "@/components/dashboard/mobile-trips-wallet";
import type { MobileWalletViewModel } from "@/lib/mobile-globe-wallet/view-model";

type MobileTripDirectWalletProps = {
  mobileWallet: MobileWalletViewModel;
  tripId: string;
};

export function MobileTripDirectWallet({ mobileWallet, tripId }: MobileTripDirectWalletProps) {
  const [query, setQuery] = useState("");
  const selectedTripId = mobileWallet.selection.tripId ?? tripId;
  const activeYear = useMemo(
    () => tripYear(mobileWallet.trips.find((trip) => trip.id === selectedTripId) ?? null) ?? String(new Date().getFullYear()),
    [mobileWallet.trips, selectedTripId]
  );
  const years = useMemo(() => {
    const tripYears = new Set(mobileWallet.trips.map((trip) => tripYear(trip)).filter(isString));
    tripYears.add(activeYear);
    return [...tripYears].sort((a, b) => Number(b) - Number(a));
  }, [activeYear, mobileWallet.trips]);
  const activeYearTrips = useMemo(
    () => orderSelectedTripFirst(mobileWallet.trips, selectedTripId),
    [mobileWallet.trips, selectedTripId]
  );

  return (
    <MobileTripsCountriesMap
      activeYear={activeYear}
      activeYearTrips={activeYearTrips}
      hydrated
      initialOverviewData={mobileWallet.selectedTrip?.overview ?? null}
      initialSelectedTripId={selectedTripId}
      initialSheetState="expanded"
      mobileWallet={mobileWallet}
      onQueryChange={setQuery}
      onYearChange={() => undefined}
      query={query}
      years={years}
    />
  );
}

function orderSelectedTripFirst<T extends { id: string }>(trips: T[], selectedTripId: string | null) {
  if (!selectedTripId) {
    return trips;
  }

  const selectedTrip = trips.find((trip) => trip.id === selectedTripId);
  if (!selectedTrip) {
    return trips;
  }

  return [selectedTrip, ...trips.filter((trip) => trip.id !== selectedTripId)];
}

function tripYear(trip: MobileWalletViewModel["trips"][number] | null) {
  if (!trip) {
    return null;
  }

  const date = trip.startDate || trip.endDate;
  if (!date) return String(new Date().getFullYear());
  const year = new Date(`${date}T00:00:00.000Z`).getUTCFullYear();
  return Number.isFinite(year) ? String(year) : String(new Date().getFullYear());
}

function isString(value: string | null): value is string {
  return typeof value === "string";
}
