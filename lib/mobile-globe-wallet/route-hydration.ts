export type MobileGlobeWalletLayerKind =
  | "launch"
  | "myTrips"
  | "tripOverview"
  | "itinerary"
  | "flights"
  | "stays"
  | "places"
  | "routes"
  | "budget"
  | "documents"
  | "createTrip"
  | "datePicker"
  | "backgroundPicker"
  | "settings";

export type MobileGlobeWalletLayer = {
  id: string;
  kind: MobileGlobeWalletLayerKind;
  itemId?: string | null;
  routeHref?: string;
  title?: string | null;
  tripId?: string | null;
};

export type MobileGlobeWalletSelection = {
  activityId: string | null;
  placeId: string | null;
  routeId: string | null;
  tripId: string | null;
};

export type MobileGlobeWalletRouteHydration = {
  activeLayer: MobileGlobeWalletLayer;
  routeHref: string;
  selection: MobileGlobeWalletSelection;
  stack: MobileGlobeWalletLayer[];
};

export type RouteSearchParamsLike = {
  get: (name: string) => string | null;
  toString: () => string;
};

export const MOBILE_GLOBE_WALLET_ROUTE_MAPPING = {
  dashboard: "launch",
  tripBudget: "budget",
  tripDocuments: "documents",
  tripIdeas: "places",
  tripMap: "routes",
  tripOverview: "tripOverview",
  trips: "myTrips",
  tripTimeline: "itinerary"
} as const satisfies Record<string, MobileGlobeWalletLayerKind>;

export const EMPTY_MOBILE_GLOBE_WALLET_SELECTION: MobileGlobeWalletSelection = {
  activityId: null,
  placeId: null,
  routeId: null,
  tripId: null
};

export function hydrateMobileGlobeWalletRoute(
  pathname: string,
  searchParams: RouteSearchParamsLike = new URLSearchParams(),
  fallbackRootLayer: MobileGlobeWalletLayerKind = "launch",
  fallbackRootRoute = "/dashboard"
): MobileGlobeWalletRouteHydration {
  const stack = buildMobileGlobeWalletStack(pathname, searchParams, fallbackRootLayer, fallbackRootRoute);
  const routeHref = routeHrefFor(pathname, searchParams);

  return {
    activeLayer: stack[stack.length - 1] ?? buildMobileGlobeWalletRootLayer(fallbackRootLayer, fallbackRootRoute),
    routeHref,
    selection: buildMobileGlobeWalletSelection(stack),
    stack
  };
}

export function buildMobileGlobeWalletStack(
  pathname: string,
  searchParams: RouteSearchParamsLike = new URLSearchParams(),
  fallbackRootLayer: MobileGlobeWalletLayerKind = "launch",
  fallbackRootRoute = "/dashboard"
) {
  const routeHref = routeHrefFor(pathname, searchParams);

  if (pathname === "/dashboard") {
    return [buildMobileGlobeWalletRootLayer(MOBILE_GLOBE_WALLET_ROUTE_MAPPING.dashboard, routeHref)];
  }

  if (pathname === "/dashboard/trips") {
    const view = searchParams.get("view");
    const stack: MobileGlobeWalletLayer[] = [
      buildMobileGlobeWalletRootLayer(MOBILE_GLOBE_WALLET_ROUTE_MAPPING.trips, "/dashboard/trips")
    ];
    if (view === "list") {
      stack.push({
        id: "myTrips:list",
        kind: "myTrips",
        routeHref,
        title: "Trip list"
      });
    }

    return stack;
  }

  const tripRoute = pathname.match(/^\/dashboard\/trips\/([^/]+)(?:\/([^/]+))?/);
  if (tripRoute) {
    const tripId = decodeURIComponent(tripRoute[1] ?? "");
    const segment = tripRoute[2] ?? "";
    const stack: MobileGlobeWalletLayer[] = [
      buildMobileGlobeWalletRootLayer(MOBILE_GLOBE_WALLET_ROUTE_MAPPING.trips, "/dashboard/trips"),
      {
        id: `trip:${tripId}:overview`,
        kind: MOBILE_GLOBE_WALLET_ROUTE_MAPPING.tripOverview,
        routeHref: `/dashboard/trips/${encodeURIComponent(tripId)}`,
        title: "Trip overview",
        tripId
      }
    ];
    const nestedLayer = mobileGlobeWalletLayerKindForTripSegment(segment);
    if (nestedLayer) {
      stack.push({
        id: `trip:${tripId}:${nestedLayer}`,
        kind: nestedLayer,
        routeHref,
        tripId
      });
    }

    return stack;
  }

  return [buildMobileGlobeWalletRootLayer(fallbackRootLayer, fallbackRootRoute)];
}

export function buildMobileGlobeWalletRootLayer(
  kind: MobileGlobeWalletLayerKind,
  routeHref: string
): MobileGlobeWalletLayer {
  return {
    id: kind,
    kind,
    routeHref
  };
}

export function buildMobileGlobeWalletSelection(stack: MobileGlobeWalletLayer[]) {
  return stack.reduce<MobileGlobeWalletSelection>(
    (selection, layer) => selectionFromMobileGlobeWalletLayer(layer, selection),
    EMPTY_MOBILE_GLOBE_WALLET_SELECTION
  );
}

export function selectionFromMobileGlobeWalletLayer(
  layer: MobileGlobeWalletLayer,
  currentSelection: MobileGlobeWalletSelection
): MobileGlobeWalletSelection {
  return {
    activityId: layer.kind === "itinerary" ? layer.itemId ?? currentSelection.activityId : currentSelection.activityId,
    placeId: layer.kind === "places" ? layer.itemId ?? currentSelection.placeId : currentSelection.placeId,
    routeId: layer.kind === "routes" ? layer.itemId ?? currentSelection.routeId : currentSelection.routeId,
    tripId: layer.tripId ?? currentSelection.tripId
  };
}

export function mobileGlobeWalletLayerKindForTripSegment(segment: string): MobileGlobeWalletLayerKind | null {
  switch (segment) {
    case "budget":
      return MOBILE_GLOBE_WALLET_ROUTE_MAPPING.tripBudget;
    case "documents":
      return MOBILE_GLOBE_WALLET_ROUTE_MAPPING.tripDocuments;
    case "flights":
      return "flights";
    case "ideas":
    case "places":
      return MOBILE_GLOBE_WALLET_ROUTE_MAPPING.tripIdeas;
    case "map":
    case "routes":
      return MOBILE_GLOBE_WALLET_ROUTE_MAPPING.tripMap;
    case "stays":
      return "stays";
    case "timeline":
      return MOBILE_GLOBE_WALLET_ROUTE_MAPPING.tripTimeline;
    default:
      return null;
  }
}

function routeHrefFor(pathname: string, searchParams: RouteSearchParamsLike) {
  const search = searchParams.toString();
  return search ? `${pathname}?${search}` : pathname;
}
