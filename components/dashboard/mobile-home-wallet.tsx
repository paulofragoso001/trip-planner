import type { DashboardData } from "@/app/dashboard/loader";
import { MobileHomeContent } from "@/components/dashboard/mobile-home-content";
import { MobileHomeGlobe } from "@/components/dashboard/mobile-home-globe";
import { cn } from "@/components/trip-ui";

type MobileHomeWalletProps = Pick<DashboardData, "metrics" | "recentTrips"> & {
  className?: string;
};

export function MobileHomeWallet({
  className,
  metrics,
  recentTrips
}: MobileHomeWalletProps) {
  const latestTrip = recentTrips[0] || null;
  const importsWaiting =
    metrics.find((metric) => metric.label === "Ideas waiting")?.value ??
    metrics.find((metric) => metric.label === "Imports waiting")?.value ??
    "0";
  const ideasWaitingCount = Number.parseInt(importsWaiting.replace(/[^\d]/g, ""), 10) || 0;
  const primaryHref = latestTrip ? latestTrip.href : "/dashboard/trips#new-trip";
  const primaryLabel = latestTrip ? "Continue trip" : "Create trip";
  const primaryMeta = latestTrip
    ? `${latestTrip.name} · ${latestTrip.destination}`
    : "Start a new travel wallet.";

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden bg-[#020916] text-white lg:hidden",
        className
      )}
      data-testid="mobile-home-wallet"
    >
      <section
        className="relative min-h-[100svh] overflow-hidden"
        data-testid="mobile-home-globe-launch"
      >
        <MobileHomeGlobe />
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(2.25rem+env(safe-area-inset-bottom))] z-10 flex justify-center">
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[0.65rem] font-black uppercase tracking-[0.2em] text-white/54 backdrop-blur">
            Scroll
          </div>
        </div>
      </section>

      <MobileHomeContent
        ideasWaitingCount={ideasWaitingCount}
        primaryHref={primaryHref}
        primaryLabel={primaryLabel}
        primaryMeta={primaryMeta}
      />
    </section>
  );
}
