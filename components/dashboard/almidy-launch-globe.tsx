"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Map } from "lucide-react";
import MobileTripsWalletSheet, {
  type MobileTripsWalletSheetTrip
} from "@/components/dashboard/mobile-trips-wallet-sheet";
import { CustomGlobeRenderer } from "@/components/map/custom-globe-renderer";
import { countryCodeToFlag } from "@/lib/map/wayline-map-pins";
import { canOpenNativeMap, openNativeMap } from "@/lib/native-map";
import type {
  AlmidyLaunchGlobeTripPin,
  AlmidyLocationState,
  AlmidyMapSurfaceState
} from "@/lib/map/wayline-map-models";

type AlmidyLaunchGlobeProps = {
  activeTripId?: string | null;
  className?: string;
  defaultFocusWhenEmpty?: boolean;
  location?: AlmidyLocationState;
  locationStatus?: LocationRequestState;
  onLocateUser?: () => Promise<AlmidyLocationState> | void;
  onTripPinSelect?: (tripId: string) => void;
  renderTripPins?: boolean;
  showCountryPin?: boolean;
  tripPins?: AlmidyLaunchGlobeTripPin[];
  useLocationFocus?: boolean;
};

type LocationRequestState = "idle" | "loading" | "ready" | "error";

const APPLE_MAP_SYSTEM_ID = "almidy-apple-map-system";
const USE_CURRENT_LOCATION_EVENT = "wayline:home-use-current-location";
const DEFAULT_CAMERA_CENTER = { lat: 28.5, lng: -81.5 };

type AlmidyLaunchGlobeHubProps = {
  savedTrips: MobileTripsWalletSheetTrip[];
};

export default function AlmidyLaunchGlobeHub({
  savedTrips
}: AlmidyLaunchGlobeHubProps) {
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [showNativeMapControl, setShowNativeMapControl] = useState(false);
  const activeTripData = savedTrips.find((trip) => trip.id === activeTripId) ?? null;
  const tripPins = savedTrips
    .map(walletTripToGlobePin)
    .filter((pin): pin is AlmidyLaunchGlobeTripPin => Boolean(pin));
  const activeFlag = activeTripData?.countryCode
    ? countryCodeToFlag(activeTripData.countryCode)
    : null;
  const handleTripPinSelect = useCallback((tripId: string) => {
    setActiveTripId(tripId);
  }, []);
  const handleOpenNativeMap = useCallback(() => {
    void openNativeMap().catch((error) => {
      console.error("Unable to open native map", error);
    });
  }, []);

  useEffect(() => {
    setShowNativeMapControl(canOpenNativeMap());
  }, []);

  return (
    <div className="fixed inset-0 flex h-screen w-screen flex-col justify-between overflow-hidden bg-[#121214]">
      <div className="absolute inset-0 z-10 h-full w-full pb-[240px]">
        <CustomGlobeRenderer
          activeTripId={activeTripId}
          defaultFocusWhenEmpty
          mapInstanceKey={`launch-hub-${savedTrips.length}`}
          onTripPinSelect={handleTripPinSelect}
          showCountryPin={false}
          tripPins={tripPins}
          useLocationFocus={false}
        />
      </div>

      {showNativeMapControl ? (
        <button
          aria-label="Open native map"
          className="absolute right-4 top-[max(16px,env(safe-area-inset-top))] z-30 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/70 text-white shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:bg-black/80 focus:outline-none focus:ring-4 focus:ring-orange-400/25"
          data-testid="ios-native-map-open"
          onClick={handleOpenNativeMap}
          type="button"
        >
          <Map className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : null}

      {activeTripId && activeTripData ? (
        <div className="absolute bottom-[280px] left-4 right-4 z-20 flex animate-in items-center justify-between rounded-xl border border-zinc-800/80 bg-[#1e1e24]/90 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.6)] backdrop-blur-md fade-in slide-in-from-bottom-3 duration-200">
          <div className="min-w-0 flex-1">
            <span className="mb-0.5 block text-[9px] font-extrabold uppercase tracking-wider text-zinc-500">
              Selected Trip
            </span>
            <h4 className="truncate text-base font-extrabold tracking-tight text-white">
              {activeTripData.city}
            </h4>
            <p className="mt-0.5 truncate text-xs font-medium text-zinc-400">
              {activeTripData.destination_name || activeTripData.date_range}
            </p>
          </div>
          <div className="ml-4 grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-zinc-700 bg-white text-lg shadow-sm">
            {activeFlag ?? "•"}
          </div>
        </div>
      ) : null}

      <div className="flex-1 pointer-events-none" />

      <div className="relative z-30 w-full shrink-0">
        <MobileTripsWalletSheet
          currentYear="2026"
          onOpenSettings={() => {}}
          onOpenStats={() => {}}
          onYearChange={() => {}}
          trips={savedTrips}
        />
      </div>
    </div>
  );
}

export function AlmidyLaunchGlobe({
  activeTripId,
  className,
  defaultFocusWhenEmpty = false,
  location,
  locationStatus = "idle",
  onLocateUser,
  onTripPinSelect,
  renderTripPins = true,
  showCountryPin = true,
  tripPins = [],
  useLocationFocus = true
}: AlmidyLaunchGlobeProps) {
  const surfaceState = useMemo<AlmidyMapSurfaceState | undefined>(() => {
    if (!location) {
      return undefined;
    }

    return {
      camera: {
        center: location.coordinate ?? DEFAULT_CAMERA_CENTER,
        intent: location.coordinate ? "user-location" : "world",
        rangeMeters: location.coordinate ? 1_200_000 : 5_000_000,
        tilt: 35,
        zoom: location.coordinate ? 6 : 3
      },
      location,
      mode: "launch-globe",
      pins: [],
      renderer: "apple-mapkit",
      routes: [],
      selectedId: location.coordinate ? "browser-location" : null
    };
  }, [location]);

  useEffect(() => {
    const useCurrentLocation = () => {
      void onLocateUser?.();
    };

    window.addEventListener(USE_CURRENT_LOCATION_EVENT, useCurrentLocation);

    return () => {
      window.removeEventListener(USE_CURRENT_LOCATION_EVENT, useCurrentLocation);
    };
  }, [onLocateUser]);

  const visibleTripPins = renderTripPins ? tripPins : [];

  return (
    <section
      className={["absolute inset-0 overflow-hidden bg-black", className].filter(Boolean).join(" ")}
      data-hero-mode="apple-mapkit"
      data-launch-globe-state={locationStatus === "loading" ? "loading-location" : "ready"}
      data-map-presentation="apple-globe"
      data-map-renderer="apple-mapkit"
      data-map-system={APPLE_MAP_SYSTEM_ID}
      data-testid="almidy-launch-globe"
    >
      <CustomGlobeRenderer
        activeTripId={activeTripId}
        className="absolute inset-0 h-full w-full"
        defaultFocusWhenEmpty={defaultFocusWhenEmpty}
        mapInstanceKey={`launch-apple-${visibleTripPins.length}-${location?.locatedAt ?? "no-location"}`}
        onTripPinSelect={onTripPinSelect}
        showCountryPin={showCountryPin}
        surfaceState={surfaceState}
        tripPins={visibleTripPins}
        useLocationFocus={useLocationFocus}
      />
    </section>
  );
}

function walletTripToGlobePin(trip: MobileTripsWalletSheetTrip): AlmidyLaunchGlobeTripPin | null {
  const lat = Number(trip.lat);
  const lng = Number(trip.lng);
  const countryCode = trip.countryCode?.trim().toUpperCase();

  if (!countryCode || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    countryCode,
    flag: countryCodeToFlag(countryCode) ?? "•",
    id: `trip-country-${trip.id}`,
    label: trip.city,
    lat,
    lng,
    subtitle: trip.destination_name || trip.date_range,
    tripId: trip.id
  };
}
