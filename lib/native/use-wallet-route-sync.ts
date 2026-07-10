"use client";

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NativeMapRevisionGate,
  parseNativeMapSyncPayload,
  type NativeMapSyncPayload
} from "@/lib/native-map-sync";

export const NATIVE_MAP_SYNC_EVENT = "onNativeStateSync";

type NativeMapSyncDraft = Omit<NativeMapSyncPayload, "revisionId">;

type NativeMapSyncEvent = CustomEvent<{
  jsonString?: unknown;
}>;

interface MapGatewayPlugin {
  addListener(
    eventName: typeof NATIVE_MAP_SYNC_EVENT,
    listener: (event: { jsonString?: unknown }) => void
  ): Promise<PluginListenerHandle>;
  acknowledgeReceipt(options: { revisionId: number }): Promise<void>;
  initializeNativeMapUnderlay(): Promise<{ height?: number; success: boolean; width?: number }>;
  setNativeMapInteractiveRegions(options: { jsonString: string }): Promise<{ success: boolean }>;
  syncPayloadToNative(options: { jsonString: string }): Promise<{ success: boolean }>;
}

export const MapGateway = registerPlugin<MapGatewayPlugin>("MapGateway");

const NATIVE_MAP_UNDERLAY_INITIALIZATION_ATTEMPTS = 5;
const NATIVE_MAP_UNDERLAY_INITIALIZATION_DELAY_MS = 180;

export async function initializeNativeMapUnderlay() {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  for (let attempt = 1; attempt <= NATIVE_MAP_UNDERLAY_INITIALIZATION_ATTEMPTS; attempt += 1) {
    const response = await MapGateway.initializeNativeMapUnderlay();
    const hasUsableSurface = response.success &&
      typeof response.width === "number" && response.width > 0 &&
      typeof response.height === "number" && response.height > 0;

    if (hasUsableSurface) {
      return true;
    }

    if (attempt < NATIVE_MAP_UNDERLAY_INITIALIZATION_ATTEMPTS) {
      await delayNativeMapUnderlayRetry();
    }
  }

  return false;
}

function delayNativeMapUnderlayRetry() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, NATIVE_MAP_UNDERLAY_INITIALIZATION_DELAY_MS);
  });
}

export async function syncNativeMapInteractiveRegions() {
  if (!Capacitor.isNativePlatform() || typeof document === "undefined") {
    return false;
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const regions = Array.from(
    document.querySelectorAll<HTMLElement>(".native-map-web-interactive, .native-map-web-opaque")
  )
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.right >= 0)
    .map((rect) => {
      const x = Math.max(0, Math.min(viewportWidth, rect.left));
      const y = Math.max(0, Math.min(viewportHeight, rect.top));
      const right = Math.max(0, Math.min(viewportWidth, rect.right));
      const bottom = Math.max(0, Math.min(viewportHeight, rect.bottom));

      return {
        height: Math.max(0, bottom - y),
        width: Math.max(0, right - x),
        x,
        y
      };
    })
    .filter((rect) => rect.width > 0 && rect.height > 0);

  try {
    const response = await MapGateway.setNativeMapInteractiveRegions({
      jsonString: JSON.stringify({ regions })
    });
    return response.success;
  } catch (error) {
    console.error("Failed to sync native map interactive regions:", error);
    return false;
  }
}

export function useWalletRouteSync() {
  const [currentPayload, setCurrentPayload] = useState<NativeMapSyncPayload | null>(null);
  const revisionGateRef = useRef(new NativeMapRevisionGate());

  const updateRouteAndWallet = useCallback(async (draft: NativeMapSyncDraft) => {
    const nextRevision = Math.max(Date.now(), (revisionGateRef.current.revisionId ?? 0) + 1);
    const signedPayload = parseNativeMapSyncPayload({ ...draft, revisionId: nextRevision });

    revisionGateRef.current.accept(signedPayload);
    setCurrentPayload(signedPayload);

    if (!Capacitor.isNativePlatform()) {
      return { success: true };
    }

    try {
      const response = await MapGateway.syncPayloadToNative({
        jsonString: JSON.stringify(signedPayload)
      });
      if (!response.success) {
        console.warn("Native rejected state update synchronization.");
      }
      return response;
    } catch (error) {
      console.error("Failed to route sync payload across Capacitor bridge:", error);
      return { success: false };
    }
  }, []);

  useEffect(() => {
    const receiveNativePayload = async (event: NativeMapSyncEvent) => {
      try {
        if (typeof event.detail?.jsonString !== "string") {
          throw new Error("Native map synchronization event did not include a JSON payload.");
        }

        const payload = parseNativeMapSyncPayload(JSON.parse(event.detail.jsonString));
        if (!revisionGateRef.current.accept(payload)) {
          return;
        }

        setCurrentPayload(payload);
        if (Capacitor.isNativePlatform()) {
          await MapGateway.acknowledgeReceipt({ revisionId: payload.revisionId });
        }
      } catch (error) {
        console.error("Failed to receive native map synchronization payload:", error);
      }
    };
    const handleNativeStateSync = (event: Event) => {
      void receiveNativePayload(event as NativeMapSyncEvent);
    };
    let disposed = false;
    let nativeListener: PluginListenerHandle | null = null;

    window.addEventListener(NATIVE_MAP_SYNC_EVENT, handleNativeStateSync);
    if (Capacitor.isNativePlatform()) {
      void MapGateway.addListener(NATIVE_MAP_SYNC_EVENT, (event) => {
        void receiveNativePayload(new CustomEvent(NATIVE_MAP_SYNC_EVENT, { detail: event }));
      }).then((listener) => {
        if (disposed) {
          void listener.remove();
          return;
        }
        nativeListener = listener;
      }).catch((error) => {
        console.error("Failed to subscribe to native map synchronization:", error);
      });
    }

    return () => {
      disposed = true;
      window.removeEventListener(NATIVE_MAP_SYNC_EVENT, handleNativeStateSync);
      void nativeListener?.remove();
    };
  }, []);

  return useMemo(
    () => ({ currentPayload, updateRouteAndWallet }),
    [currentPayload, updateRouteAndWallet]
  );
}

export type WalletRouteSync = ReturnType<typeof useWalletRouteSync>;
