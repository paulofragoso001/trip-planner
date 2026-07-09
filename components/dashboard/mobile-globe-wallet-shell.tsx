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
import {
  buildMobileGlobeWalletRootLayer,
  EMPTY_MOBILE_GLOBE_WALLET_SELECTION,
  hydrateMobileGlobeWalletRoute,
  selectionFromMobileGlobeWalletLayer,
  type MobileGlobeWalletLayer,
  type MobileGlobeWalletLayerKind,
  type MobileGlobeWalletSelection
} from "@/lib/mobile-globe-wallet/route-hydration";

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

  useEffect(() => {
    setStack(routeHydration.stack);
    setSelection(routeHydration.selection);
  }, [routeHydration]);

  const pushLayer = useCallback((layer: MobileGlobeWalletLayer) => {
    setStack((current) => [...current, layer]);
    setSelection((current) => selectionFromMobileGlobeWalletLayer(layer, current));
  }, []);

  const popLayer = useCallback(() => {
    setStack((current) => {
      if (current.length <= 1) {
        return current;
      }

      const nextStack = current.slice(0, -1);
      setSelection(hydrateSelectionFromStack(nextStack));
      return nextStack;
    });
  }, []);

  const replaceLayer = useCallback((layer: MobileGlobeWalletLayer) => {
    setStack((current) => {
      const nextStack = current.length ? [...current.slice(0, -1), layer] : [layer];
      setSelection(hydrateSelectionFromStack(nextStack));
      return nextStack;
    });
  }, []);

  const activeLayer = stack[stack.length - 1] ?? buildMobileGlobeWalletRootLayer(rootLayer, rootRoute);
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

function hydrateSelectionFromStack(stack: MobileGlobeWalletLayer[]) {
  return stack.reduce<MobileGlobeWalletSelection>(
    (selection, layer) => selectionFromMobileGlobeWalletLayer(layer, selection),
    EMPTY_MOBILE_GLOBE_WALLET_SELECTION
  );
}
