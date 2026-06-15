import type { DashboardData } from "@/app/dashboard/loader";
import { MobileHomeGlobe } from "@/components/dashboard/mobile-home-globe";
import { MobileHomeSheet } from "@/components/dashboard/mobile-home-sheet";
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
        "relative isolate min-h-[calc(100dvh-6.25rem)] overflow-hidden bg-[#020916] text-white lg:hidden",
        className
      )}
      data-testid="mobile-home-wallet"
    >
      <MobileHomeGlobe />

      <div className="relative z-10 flex min-h-[calc(100dvh-6.25rem)] flex-col justify-end px-4 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-8">
        <div className="mb-5 text-center">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-orange-300/86">
            Wayline
          </p>
          <h1 className="mt-2 text-4xl font-black leading-none tracking-normal text-white">
            Travel wallet
          </h1>
          <p className="mx-auto mt-2 max-w-[20rem] text-sm font-semibold leading-5 text-slate-300">
            Pick up a trip, start planning, or review saved ideas.
          </p>
        </div>

        <MobileHomeSheet
          ideasWaitingCount={ideasWaitingCount}
          primaryHref={primaryHref}
          primaryLabel={primaryLabel}
          primaryMeta={primaryMeta}
        />
      </div>
    </section>
  );
}
