import type { DashboardData } from "@/app/dashboard/loader";
import { MobileHomeContent } from "@/components/dashboard/mobile-home-content";
import { Photorealistic3DHomeHero } from "@/components/dashboard/photorealistic-3d-home-hero";
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
        className="relative h-[clamp(220px,34svh,320px)] overflow-hidden bg-[#020817]"
        data-testid="mobile-home-3d-hero"
      >
        <Photorealistic3DHomeHero />
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
