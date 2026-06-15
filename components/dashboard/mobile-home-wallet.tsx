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
        className="relative h-[44svh] min-h-[18rem] max-h-[29rem] overflow-hidden bg-[#020817]"
        data-testid="mobile-home-earth-hero"
      >
        <MobileHomeGlobe />
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
