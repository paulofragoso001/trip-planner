export type MobileGlobeWalletLayerKind =
  | "launch"
  | "myTrips"
  | "tripOverview"
  | "itinerary"
  | "activityDetail"
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

export type MobileGlobeWalletUrlSyncMode = "push" | "replace";

export type RouteSearchParamsLike = {
  get: (name: string) => string | null;
  toString: () => string;
};

export const MOBILE_GLOBE_WALLET_ROUTE_MAPPING = {
  account: "settings",
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

export const hydrateFromRoute = hydrateMobileGlobeWalletRoute;

export function pushMobileGlobeWalletLayer(
  stack: MobileGlobeWalletLayer[],
  layer: MobileGlobeWalletLayer
): MobileGlobeWalletLayer[] {
  return [...stack, layer];
}

export function popMobileGlobeWalletLayer(stack: MobileGlobeWalletLayer[]): MobileGlobeWalletLayer[] {
  if (stack.length <= 1) {
    return stack;
  }

  return stack.slice(0, -1);
}

export function replaceMobileGlobeWalletLayer(
  stack: MobileGlobeWalletLayer[],
  layer: MobileGlobeWalletLayer
): MobileGlobeWalletLayer[] {
  return stack.length ? [...stack.slice(0, -1), layer] : [layer];
}

export function getActiveMobileGlobeWalletLayer(
  stack: MobileGlobeWalletLayer[],
  fallbackLayer: MobileGlobeWalletLayer
): MobileGlobeWalletLayer {
  return stack[stack.length - 1] ?? fallbackLayer;
}

export function syncUrlFromLayer(layer: MobileGlobeWalletLayer, stack: MobileGlobeWalletLayer[] = []): string {
  return hrefForMobileGlobeWalletLayer(layer, stack);
}

export function hrefForMobileGlobeWalletLayer(
  layer: MobileGlobeWalletLayer,
  stack: MobileGlobeWalletLayer[] = []
): string {
  if (layer.routeHref) {
    return layer.routeHref;
  }

  const tripId = layer.tripId ?? findLastTripId(stack);
  const encodedTripId = tripId ? encodeURIComponent(tripId) : null;

  switch (layer.kind) {
    case "launch":
      return "/dashboard";
    case "myTrips":
      return "/dashboard/trips";
    case "settings":
      return "/dashboard/account";
    case "tripOverview":
      return encodedTripId ? `/dashboard/trips/${encodedTripId}` : "/dashboard/trips";
    case "itinerary":
      return encodedTripId ? `/dashboard/trips/${encodedTripId}/timeline` : "/dashboard/trips";
    case "activityDetail":
      return encodedTripId && layer.itemId
        ? `/dashboard/trips/${encodedTripId}/timeline/${encodeURIComponent(layer.itemId)}`
        : encodedTripId
          ? `/dashboard/trips/${encodedTripId}/timeline`
          : "/dashboard/trips";
    case "flights":
      return encodedTripId ? `/dashboard/trips/${encodedTripId}/flights` : "/dashboard/trips";
    case "stays":
      return encodedTripId ? `/dashboard/trips/${encodedTripId}/stays` : "/dashboard/trips";
    case "places":
      return encodedTripId ? `/dashboard/trips/${encodedTripId}/ideas` : "/dashboard/trips";
    case "routes":
      return encodedTripId ? `/dashboard/trips/${encodedTripId}/map` : "/dashboard/trips";
    case "budget":
      return encodedTripId ? `/dashboard/trips/${encodedTripId}/budget` : "/dashboard/trips";
    case "documents":
      return encodedTripId ? `/dashboard/trips/${encodedTripId}/documents` : "/dashboard/trips";
    case "createTrip":
    case "datePicker":
    case "backgroundPicker":
      return findLastRouteHref(stack) ?? "/dashboard";
  }
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

  if (pathname === "/dashboard/account") {
    return [buildMobileGlobeWalletRootLayer(MOBILE_GLOBE_WALLET_ROUTE_MAPPING.account, routeHref)];
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

  const tripRoute = pathname.match(/^\/dashboard\/trips\/([^/]+)(?:\/(.+))?/);
  if (tripRoute) {
    const tripId = decodeURIComponent(tripRoute[1] ?? "");
    const routeSegments = (tripRoute[2] ?? "").split("/").filter(Boolean);
    const segment = routeSegments[0] ?? "";
    const itemId = routeSegments[1] ? decodeURIComponent(routeSegments[1]) : null;
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

    if (nestedLayer === "itinerary" && itemId) {
      stack.push({
        id: `trip:${tripId}:activity:${itemId}`,
        itemId,
        kind: "activityDetail",
        routeHref,
        title: "Activity detail",
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
    activityId:
      layer.kind === "itinerary" || layer.kind === "activityDetail"
        ? layer.itemId ?? currentSelection.activityId
        : currentSelection.activityId,
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

function findLastTripId(stack: MobileGlobeWalletLayer[]) {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const tripId = stack[index]?.tripId;
    if (tripId) {
      return tripId;
    }
  }

  return null;
}

function findLastRouteHref(stack: MobileGlobeWalletLayer[]) {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const routeHref = stack[index]?.routeHref;
    if (routeHref) {
      return routeHref;
    }
  }

  return null;
}
