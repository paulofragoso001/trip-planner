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
  syncPayloadToNative(options: { jsonString: string }): Promise<{ success: boolean }>;
}

export const MapGateway = registerPlugin<MapGatewayPlugin>("MapGateway");

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
