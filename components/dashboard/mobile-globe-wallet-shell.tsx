"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  UnifiedMapProvider,
  type UnifiedMapProviderProps
} from "@/lib/map/unified-map-provider";
import type { AlmidyMapMode } from "@/lib/map/wayline-map-models";

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

export type MobileGlobeWalletContextValue = {
  activeLayer: MobileGlobeWalletLayer;
  popLayer: () => void;
  pushLayer: (layer: MobileGlobeWalletLayer) => void;
  replaceLayer: (layer: MobileGlobeWalletLayer) => void;
  selection: MobileGlobeWalletSelection;
  setSelection: (selection: MobileGlobeWalletSelection) => void;
  stack: MobileGlobeWalletLayer[];
};

type MobileGlobeWalletShellProps = {
  autoLocate?: UnifiedMapProviderProps["autoLocate"];
  autoLocateMode?: UnifiedMapProviderProps["autoLocateMode"];
  children: ReactNode;
  className?: string;
  initialMode?: AlmidyMapMode;
  rootLayer?: MobileGlobeWalletLayerKind;
  rootRoute?: string;
};

const EMPTY_SELECTION: MobileGlobeWalletSelection = {
  activityId: null,
  placeId: null,
  routeId: null,
  tripId: null
};

const MobileGlobeWalletContext = createContext<MobileGlobeWalletContextValue | null>(null);

export function MobileGlobeWalletShell({
  autoLocate = false,
  autoLocateMode,
  children,
  className = "contents",
  initialMode = "globe",
  rootLayer = "launch",
  rootRoute = "/dashboard"
}: MobileGlobeWalletShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamString = searchParams.toString();
  const routeHref = searchParamString ? `${pathname}?${searchParamString}` : pathname;
  const routeSearchParams = useMemo(
    () => new URLSearchParams(searchParamString),
    [searchParamString]
  );
  const routeStack = useMemo(
    () => buildWalletStackFromRoute(pathname, routeSearchParams, rootLayer, rootRoute),
    [pathname, rootLayer, rootRoute, routeSearchParams]
  );
  const routeSelection = useMemo(
    () => buildSelectionFromStack(routeStack),
    [routeStack]
  );
  const [stack, setStack] = useState<MobileGlobeWalletLayer[]>(routeStack);
  const [selection, setSelection] = useState<MobileGlobeWalletSelection>(routeSelection);

  useEffect(() => {
    setStack(routeStack);
    setSelection(routeSelection);
  }, [routeHref, routeSelection, routeStack]);

  const pushLayer = useCallback((layer: MobileGlobeWalletLayer) => {
    setStack((current) => [...current, layer]);
    setSelection((current) => selectionFromLayer(layer, current));
  }, []);

  const popLayer = useCallback(() => {
    setStack((current) => {
      if (current.length <= 1) {
        return current;
      }

      const nextStack = current.slice(0, -1);
      setSelection(buildSelectionFromStack(nextStack));
      return nextStack;
    });
  }, []);

  const replaceLayer = useCallback((layer: MobileGlobeWalletLayer) => {
    setStack((current) => {
      const nextStack = current.length ? [...current.slice(0, -1), layer] : [layer];
      setSelection(buildSelectionFromStack(nextStack));
      return nextStack;
    });
  }, []);

  const activeLayer = stack[stack.length - 1] ?? buildRootLayer(rootLayer, rootRoute);
  const contextValue = useMemo<MobileGlobeWalletContextValue>(
    () => ({
      activeLayer,
      popLayer,
      pushLayer,
      replaceLayer,
      selection,
      setSelection,
      stack
    }),
    [activeLayer, popLayer, pushLayer, replaceLayer, selection, stack]
  );

  return (
    <UnifiedMapProvider
      autoLocate={autoLocate}
      autoLocateMode={autoLocateMode}
      initialMode={initialMode}
    >
      <MobileGlobeWalletContext.Provider value={contextValue}>
        <section
          className={className}
          data-wallet-active-layer={activeLayer.kind}
          data-wallet-root-route={rootRoute}
          data-wallet-selected-activity-id={selection.activityId ?? undefined}
          data-wallet-selected-place-id={selection.placeId ?? undefined}
          data-wallet-selected-route-id={selection.routeId ?? undefined}
          data-wallet-selected-trip-id={selection.tripId ?? undefined}
          data-wallet-stack={stack.map((layer) => layer.kind).join(">")}
          data-testid="mobile-globe-wallet-shell"
        >
          {children}
        </section>
      </MobileGlobeWalletContext.Provider>
    </UnifiedMapProvider>
  );
}

export function useMobileGlobeWallet() {
  const context = useContext(MobileGlobeWalletContext);
  if (!context) {
    throw new Error("useMobileGlobeWallet must be used inside MobileGlobeWalletShell");
  }

  return context;
}

function buildWalletStackFromRoute(
  pathname: string,
  searchParams: URLSearchParams | ReadonlyURLSearchParams,
  rootLayer: MobileGlobeWalletLayerKind,
  rootRoute: string
) {
  const routeHref = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;

  if (pathname === "/dashboard") {
    return [buildRootLayer("launch", routeHref)];
  }

  if (pathname === "/dashboard/trips") {
    const view = searchParams.get("view");
    const stack: MobileGlobeWalletLayer[] = [buildRootLayer("myTrips", "/dashboard/trips")];
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
      buildRootLayer("myTrips", "/dashboard/trips"),
      {
        id: `trip:${tripId}:overview`,
        kind: "tripOverview",
        routeHref: `/dashboard/trips/${encodeURIComponent(tripId)}`,
        title: "Trip overview",
        tripId
      }
    ];
    const nestedLayer = layerKindForTripSegment(segment);
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

  return [buildRootLayer(rootLayer, rootRoute)];
}

function buildRootLayer(kind: MobileGlobeWalletLayerKind, routeHref: string): MobileGlobeWalletLayer {
  return {
    id: kind,
    kind,
    routeHref
  };
}

function buildSelectionFromStack(stack: MobileGlobeWalletLayer[]) {
  return stack.reduce<MobileGlobeWalletSelection>(
    (selection, layer) => selectionFromLayer(layer, selection),
    EMPTY_SELECTION
  );
}

function selectionFromLayer(
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

function layerKindForTripSegment(segment: string): MobileGlobeWalletLayerKind | null {
  switch (segment) {
    case "budget":
      return "budget";
    case "documents":
      return "documents";
    case "flights":
      return "flights";
    case "ideas":
    case "places":
      return "places";
    case "map":
    case "routes":
      return "routes";
    case "stays":
      return "stays";
    case "timeline":
      return "itinerary";
    default:
      return null;
  }
}

type ReadonlyURLSearchParams = {
  get: (name: string) => string | null;
  toString: () => string;
};
