import type { TripMapItem } from "@/components/TripMap";
import type { MobileFlightRoutePreview } from "@/components/trip/mobile-flight-route-card";
import type { TripBudgetData } from "@/app/dashboard/trips/[tripId]/budget/types";
import type { TripMapData } from "@/app/dashboard/trips/[tripId]/map/loader";
import type { TripOverviewData } from "@/app/dashboard/trips/[tripId]/overview-loader";
import type { TimelineItemView, TripTimelineData } from "@/app/dashboard/trips/[tripId]/timeline/types";
import type { TripsData } from "@/app/dashboard/trips/loader";
import type {
  MobileGlobeWalletLayer,
  MobileGlobeWalletRouteHydration,
  MobileGlobeWalletSelection
} from "@/lib/mobile-globe-wallet/route-hydration";
import type { WalletHeroImage } from "@/lib/wallet/hero-image";

export type MobileWalletDocumentView = {
  href: string;
  id: string;
  metaLabel: string;
  title: string;
  typeLabel: string;
};

export type MobileWalletBudgetSummary = Pick<
  TripBudgetData,
  "actualLabel" | "alerts" | "categories" | "currencyTotals" | "latestRecords" | "plannedLabel" | "remainingLabel"
>;

export type MobileWalletRouteFlightData = {
  flightPreview: MobileFlightRoutePreview | null;
  firstFlight: TimelineItemView | null;
  mapItems: TripMapItem[];
  routePreview: TripOverviewData["routePreview"];
};

export type MobileWalletSelectedTripView = {
  budgetSummary: MobileWalletBudgetSummary | null;
  documents: MobileWalletDocumentView[];
  heroImagery: WalletHeroImage;
  itinerarySegments: TimelineItemView[];
  mappedActivities: TripMapItem[];
  mapData: TripMapData | null;
  overview: TripOverviewData;
  routeFlightData: MobileWalletRouteFlightData;
  timeline: TripTimelineData | null;
  tripId: string;
};

export type MobileWalletViewModel = {
  activeLayer: MobileGlobeWalletLayer;
  error: string | null;
  heroImagery: WalletHeroImage;
  routeHref: string;
  selectedTrip: MobileWalletSelectedTripView | null;
  selection: MobileGlobeWalletSelection;
  stack: MobileGlobeWalletLayer[];
  trips: TripsData["trips"];
};

export type BuildMobileWalletViewModelInput = {
  budget: TripBudgetData | null;
  mapData: TripMapData | null;
  overview: TripOverviewData | null;
  routeHydration: MobileGlobeWalletRouteHydration;
  timeline: TripTimelineData | null;
  tripsData: TripsData;
};

export function buildMobileWalletViewModel(input: BuildMobileWalletViewModelInput): MobileWalletViewModel {
  const selectedTrip = input.overview
    ? buildSelectedTripView({
        budget: input.budget,
        mapData: input.mapData,
        overview: input.overview,
        timeline: input.timeline
      })
    : null;

  return {
    activeLayer: input.routeHydration.activeLayer,
    error:
      input.tripsData.error ||
      selectedTrip?.overview.error ||
      selectedTrip?.timeline?.error ||
      selectedTrip?.mapData?.error ||
      null,
    heroImagery: selectedTrip?.heroImagery ?? input.tripsData.heroImage,
    routeHref: input.routeHydration.routeHref,
    selectedTrip,
    selection: input.routeHydration.selection,
    stack: input.routeHydration.stack,
    trips: input.tripsData.trips
  };
}

function buildSelectedTripView({
  budget,
  mapData,
  overview,
  timeline
}: {
  budget: TripBudgetData | null;
  mapData: TripMapData | null;
  overview: TripOverviewData;
  timeline: TripTimelineData | null;
}): MobileWalletSelectedTripView {
  const itinerarySegments = timeline ? timeline.days.flatMap((day) => day.items) : [];
  const mappedActivities = mapData?.items.length ? mapData.items : overview.mapPreviewItems;

  return {
    budgetSummary: budget ? mapBudgetSummary(budget) : null,
    documents: overview.documentsPreview,
    heroImagery: overview.heroImage,
    itinerarySegments,
    mappedActivities,
    mapData,
    overview,
    routeFlightData: {
      flightPreview: overview.flightPreview,
      firstFlight: timeline?.firstFlight ?? null,
      mapItems: mappedActivities,
      routePreview: overview.routePreview
    },
    timeline,
    tripId: overview.tripId
  };
}

function mapBudgetSummary(data: TripBudgetData): MobileWalletBudgetSummary {
  return {
    actualLabel: data.actualLabel,
    alerts: data.alerts,
    categories: data.categories,
    currencyTotals: data.currencyTotals,
    latestRecords: data.latestRecords,
    plannedLabel: data.plannedLabel,
    remainingLabel: data.remainingLabel
  };
}
