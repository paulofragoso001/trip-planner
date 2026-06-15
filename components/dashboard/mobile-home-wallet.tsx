import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Map,
  Plane,
  Plus,
  Search,
  Sparkles
} from "lucide-react";
import type { DashboardData } from "@/app/dashboard/loader";
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

        <div className="rounded-t-[2.25rem] border border-white/12 bg-[#050914]/88 p-4 shadow-[0_-28px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-white/34" />
          <div className="grid gap-3">
            <HomeWalletAction
              href={primaryHref}
              icon={<Plane className="h-5 w-5" aria-hidden="true" />}
              label={primaryLabel}
              meta={primaryMeta}
              primary
            />
            <div className="grid grid-cols-2 gap-3">
              <HomeWalletTile
                href="/dashboard/imports"
                icon={<Plus className="h-5 w-5" aria-hidden="true" />}
                label="Add idea"
              />
              <HomeWalletTile
                href="/dashboard/search"
                icon={<Search className="h-5 w-5" aria-hidden="true" />}
                label="Search"
              />
            </div>
            {ideasWaitingCount > 0 ? (
              <HomeWalletAction
                href="/dashboard/imports#ai-review"
                icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
                label="Review places"
                meta={`${ideasWaitingCount} item${ideasWaitingCount === 1 ? "" : "s"} waiting`}
              />
            ) : null}
            <HomeWalletAction
              href="/dashboard/map"
              icon={<Map className="h-5 w-5" aria-hidden="true" />}
              label="Open map"
              meta="View your trips on the map."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function HomeWalletAction({
  href,
  icon,
  label,
  meta,
  primary = false
}: {
  href: string;
  icon: ReactNode;
  label: string;
  meta: string;
  primary?: boolean;
}) {
  return (
    <Link
      className={cn(
        "grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.45rem] px-4 py-3 text-left transition focus:outline-none focus:ring-4 focus:ring-orange-300/20",
        primary
          ? "bg-white text-slate-950 shadow-[0_16px_44px_rgba(255,255,255,0.12)]"
          : "bg-white/[0.075] text-white ring-1 ring-white/10 hover:bg-white/12"
      )}
      href={href}
    >
      <span
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-full",
          primary ? "bg-slate-950 text-orange-300" : "bg-orange-500/16 text-orange-300"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-black">{label}</span>
        <span
          className={cn(
            "mt-0.5 block truncate text-xs font-bold",
            primary ? "text-slate-600" : "text-slate-400"
          )}
        >
          {meta}
        </span>
      </span>
      <ArrowRight
        className={cn("h-4 w-4", primary ? "text-slate-400" : "text-white/42")}
        aria-hidden="true"
      />
    </Link>
  );
}

function HomeWalletTile({
  href,
  icon,
  label
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      className="grid min-h-24 place-items-center gap-2 rounded-[1.45rem] bg-white/[0.075] px-3 py-4 text-center text-sm font-black text-white ring-1 ring-white/10 transition hover:bg-white/12 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
      href={href}
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-orange-500/16 text-orange-300">
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}
