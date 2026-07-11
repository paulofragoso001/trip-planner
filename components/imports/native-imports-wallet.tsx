"use client";

import type { ReactNode } from "react";
import { CustomGlobeRenderer } from "@/components/map/custom-globe-renderer";
import { MobileGlobeWalletShell } from "@/components/dashboard/mobile-globe-wallet-shell";

export function NativeImportsWallet({ children }: { children: ReactNode }) {
  return (
    <MobileGlobeWalletShell initialMode="globe" rootLayer="launch" rootRoute="/dashboard">
      <section
        className="native-map-surface-shell relative isolate h-[100dvh] min-h-[100dvh] overflow-hidden bg-black text-white"
        data-testid="native-imports-wallet"
      >
        <CustomGlobeRenderer
          className="native-map-pointer-passthrough absolute inset-0 h-full w-full"
          data-testid="native-imports-globe"
        />
        <div
          className="native-map-web-interactive native-map-web-opaque fixed inset-x-0 bottom-0 z-50 max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] overflow-y-auto overscroll-contain rounded-t-[28px] border-t border-white/10 bg-[#4d4942]/94 text-white shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
          data-testid="native-imports-wallet-sheet"
        >
          {children}
        </div>
      </section>
    </MobileGlobeWalletShell>
  );
}
