import "server-only";

import { loadDashboardData } from "@/app/dashboard/loader";
import { loadTripBudgetData } from "@/app/dashboard/trips/[tripId]/budget/loader";
import { loadTripMapData } from "@/app/dashboard/trips/[tripId]/map/loader";
import { loadTripOverviewData } from "@/app/dashboard/trips/[tripId]/overview-loader";
import { loadTripTimelineData } from "@/app/dashboard/trips/[tripId]/timeline/loader";
import { loadTripsData } from "@/app/dashboard/trips/loader";
import {
  hydrateMobileGlobeWalletRoute,
  type MobileGlobeWalletLayerKind,
  type RouteSearchParamsLike
} from "@/lib/mobile-globe-wallet/route-hydration";
import {
  buildMobileWalletViewModel,
  type MobileWalletViewModel
} from "@/lib/mobile-globe-wallet/view-model";

export type LoadMobileWalletViewModelInput = {
  pathname: string;
  searchParams?: RouteSearchParamsLike;
};

export async function loadMobileWalletViewModel({
  pathname,
  searchParams = new URLSearchParams()
}: LoadMobileWalletViewModelInput): Promise<MobileWalletViewModel> {
  const routeHydration = hydrateMobileGlobeWalletRoute(pathname, searchParams);
  const selectedTripId = routeHydration.selection.tripId;

  const dashboardPromise =
    routeHydration.activeLayer.kind === "launch" ? loadDashboardData() : Promise.resolve(null);
  const tripsDataPromise = loadTripsData();
  const overviewPromise = selectedTripId ? loadTripOverviewData(selectedTripId) : Promise.resolve(null);
  const timelinePromise = selectedTripId ? loadTripTimelineData(selectedTripId) : Promise.resolve(null);
  const mapDataPromise =
    selectedTripId && shouldLoadFullMapData(routeHydration.activeLayer.kind)
      ? loadTripMapData(selectedTripId)
      : Promise.resolve(null);
  const budgetPromise = selectedTripId ? loadTripBudgetData(selectedTripId) : Promise.resolve(null);

  const [dashboard, tripsData, overview, timeline, mapData, budget] = await Promise.all([
    dashboardPromise,
    tripsDataPromise,
    overviewPromise,
    timelinePromise,
    mapDataPromise,
    budgetPromise
  ]);

  return buildMobileWalletViewModel({
    budget,
    dashboard,
    mapData,
    overview,
    routeHydration,
    timeline,
    tripsData
  });
}

function shouldLoadFullMapData(kind: MobileGlobeWalletLayerKind) {
  return kind === "routes" || kind === "places" || kind === "activityDetail";
}
