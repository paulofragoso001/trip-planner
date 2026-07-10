"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { useWalletRouteSync, type WalletRouteSync } from "@/lib/native/use-wallet-route-sync";
import {
  buildMobileGlobeWalletRootLayer,
  getActiveMobileGlobeWalletLayer,
  hydrateFromRoute as hydrateMobileGlobeWalletFromRoute,
  EMPTY_MOBILE_GLOBE_WALLET_SELECTION,
  hydrateMobileGlobeWalletRoute,
  popMobileGlobeWalletLayer,
  pushMobileGlobeWalletLayer,
  replaceMobileGlobeWalletLayer,
  selectionFromMobileGlobeWalletLayer,
  syncUrlFromLayer as hrefFromMobileGlobeWalletLayer,
  type MobileGlobeWalletLayer,
  type MobileGlobeWalletLayerKind,
  type MobileGlobeWalletSelection,
  type MobileGlobeWalletUrlSyncMode
} from "@/lib/mobile-globe-wallet/route-hydration";

export type MobileGlobeWalletContextValue = {
  activeLayer: MobileGlobeWalletLayer;
  hydrateFromRoute: (nextPathname?: string, nextSearchParams?: URLSearchParams | string) => void;
  popLayer: () => void;
  pushLayer: (layer: MobileGlobeWalletLayer) => void;
  replaceLayer: (layer: MobileGlobeWalletLayer) => void;
  selection: MobileGlobeWalletSelection;
  setSelection: (selection: MobileGlobeWalletSelection) => void;
  stack: MobileGlobeWalletLayer[];
  syncUrlFromLayer: (layer?: MobileGlobeWalletLayer, mode?: MobileGlobeWalletUrlSyncMode) => string;
  walletRouteSync: WalletRouteSync;
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamString = searchParams.toString();
  const routeSearchParams = useMemo(
    () => new URLSearchParams(searchParamString),
    [searchParamString]
  );
  const routeHydration = useMemo(
    () => hydrateMobileGlobeWalletRoute(pathname, routeSearchParams, rootLayer, rootRoute),
    [pathname, rootLayer, rootRoute, routeSearchParams]
  );
  const [stack, setStack] = useState<MobileGlobeWalletLayer[]>(routeHydration.stack);
  const [selection, setSelection] = useState<MobileGlobeWalletSelection>(routeHydration.selection);
  const walletRouteSync = useWalletRouteSync();

  useEffect(() => {
    setStack(routeHydration.stack);
    setSelection(routeHydration.selection);
  }, [routeHydration]);

  useEffect(() => {
    const payload = walletRouteSync.currentPayload;
    if (!payload) return;

    setSelection((current) => ({
      ...current,
      routeId: payload.routeId,
      tripId: payload.trip.tripId
    }));
  }, [walletRouteSync.currentPayload]);

  const pushLayer = useCallback((layer: MobileGlobeWalletLayer) => {
    setStack((current) => pushMobileGlobeWalletLayer(current, layer));
    setSelection((current) => selectionFromMobileGlobeWalletLayer(layer, current));
  }, []);

  const popLayer = useCallback(() => {
    setStack((current) => {
      const nextStack = popMobileGlobeWalletLayer(current);
      setSelection(hydrateSelectionFromStack(nextStack));
      return nextStack;
    });
  }, []);

  const replaceLayer = useCallback((layer: MobileGlobeWalletLayer) => {
    setStack((current) => {
      const nextStack = replaceMobileGlobeWalletLayer(current, layer);
      setSelection(hydrateSelectionFromStack(nextStack));
      return nextStack;
    });
  }, []);

  const hydrateFromRoute = useCallback(
    (nextPathname = pathname, nextSearchParams: URLSearchParams | string = routeSearchParams) => {
      const searchParamsForHydration =
        typeof nextSearchParams === "string" ? new URLSearchParams(nextSearchParams) : nextSearchParams;
      const nextHydration = hydrateMobileGlobeWalletFromRoute(
        nextPathname,
        searchParamsForHydration,
        rootLayer,
        rootRoute
      );
      setStack(nextHydration.stack);
      setSelection(nextHydration.selection);
    },
    [pathname, rootLayer, rootRoute, routeSearchParams]
  );

  const activeLayer = getActiveMobileGlobeWalletLayer(
    stack,
    buildMobileGlobeWalletRootLayer(rootLayer, rootRoute)
  );
  const syncUrlFromLayer = useCallback(
    (layer = activeLayer, mode: MobileGlobeWalletUrlSyncMode = "push") => {
      const href = hrefFromMobileGlobeWalletLayer(layer, stack);
      if (mode === "replace") {
        router.replace(href, { scroll: false });
      } else {
        router.push(href, { scroll: false });
      }
      return href;
    },
    [activeLayer, router, stack]
  );
  const contextValue = useMemo<MobileGlobeWalletContextValue>(
    () => ({
      activeLayer,
      hydrateFromRoute,
      popLayer,
      pushLayer,
      replaceLayer,
      selection,
      setSelection,
      stack,
      syncUrlFromLayer,
      walletRouteSync
    }),
    [activeLayer, hydrateFromRoute, popLayer, pushLayer, replaceLayer, selection, stack, syncUrlFromLayer, walletRouteSync]
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

export function useOptionalMobileGlobeWallet() {
  return useContext(MobileGlobeWalletContext);
}

function hydrateSelectionFromStack(stack: MobileGlobeWalletLayer[]) {
  return stack.reduce<MobileGlobeWalletSelection>(
    (selection, layer) => selectionFromMobileGlobeWalletLayer(layer, selection),
    EMPTY_MOBILE_GLOBE_WALLET_SELECTION
  );
}
