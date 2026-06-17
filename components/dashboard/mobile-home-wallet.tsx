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
        "relative isolate h-[100dvh] overflow-x-hidden overflow-y-auto overscroll-none bg-[#020817] text-white [-webkit-overflow-scrolling:touch] lg:hidden",
        className
      )}
      data-testid="mobile-home-wallet"
    >
      <section
        className="relative h-[34dvh] min-h-[238px] max-h-[330px] overflow-hidden bg-[#020817] min-[390px]:min-h-[252px]"
        data-testid="mobile-home-3d-hero"
      >
        <Photorealistic3DHomeHero />
      </section>

      <div
        className="relative z-10 -mt-5 px-4 pb-[calc(7.25rem+env(safe-area-inset-bottom))]"
        data-testid="mobile-home-wallet-stage"
      >
        <MobileHomeContent
          ideasWaitingCount={ideasWaitingCount}
          primaryHref={primaryHref}
          primaryLabel={primaryLabel}
          primaryMeta={primaryMeta}
        />
      </div>
    </section>
  );
}
