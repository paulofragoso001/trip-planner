import { Compass, Map, Plane, Search, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/components/trip-ui";

type DashboardLoadingStateProps = {
  eyebrow?: string;
  title?: string;
  variant?: "globe" | "trips" | "workspace" | "panel";
};

const variantCopy = {
  globe: {
    eyebrow: "Wayline",
    title: "Preparing your travel wallet"
  },
  panel: {
    eyebrow: "Wayline",
    title: "Loading workspace"
  },
  trips: {
    eyebrow: "My Trips",
    title: "Loading your trip passes"
  },
  workspace: {
    eyebrow: "Trip Pass",
    title: "Opening trip workspace"
  }
} as const;

export function DashboardLoadingState({
  eyebrow,
  title,
  variant = "panel"
}: DashboardLoadingStateProps) {
  const copy = variantCopy[variant];
  const resolvedEyebrow = eyebrow || copy.eyebrow;
  const resolvedTitle = title || copy.title;

  if (variant === "globe") {
    return (
      <section
        aria-busy="true"
        aria-label={resolvedTitle}
        className="relative isolate h-[100dvh] overflow-hidden bg-black text-white"
        data-testid="dashboard-loading-globe"
      >
        <GlobeBackdrop />
        <FloatingMapControls />
        <CountryPin />
        <CollapsedWalletSkeleton eyebrow={resolvedEyebrow} title={resolvedTitle} />
      </section>
    );
  }

  if (variant === "trips") {
    return (
      <section
        aria-busy="true"
        aria-label={resolvedTitle}
        className="relative isolate min-h-[100dvh] overflow-hidden bg-black text-white lg:min-h-[42rem] lg:rounded-[2rem]"
        data-testid="dashboard-loading-trips"
      >
        <GlobeBackdrop compact />
        <ExpandedTripsSheet eyebrow={resolvedEyebrow} title={resolvedTitle} />
      </section>
    );
  }

  if (variant === "workspace") {
    return (
      <section
        aria-busy="true"
        aria-label={resolvedTitle}
        className="min-h-[100dvh] bg-[#050816] text-white lg:rounded-[2rem]"
        data-testid="dashboard-loading-workspace"
      >
        <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-[0_28px_90px_rgba(0,0,0,0.34)]">
            <div className="relative min-h-[18rem] overflow-hidden bg-slate-950">
              <GlobeBackdrop compact />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <SkeletonLine className="h-4 w-28 bg-white/24" />
                <SkeletonLine className="mt-3 h-10 w-2/3 max-w-[30rem] bg-white/32" />
                <div className="mt-4 flex gap-2">
                  <SkeletonPill className="w-24 bg-white/20" />
                  <SkeletonPill className="w-28 bg-white/20" />
                  <SkeletonPill className="w-20 bg-white/20" />
                </div>
              </div>
            </div>
            <div className="grid gap-4 bg-white p-4 text-slate-950 sm:p-5">
              <div className="flex gap-2 overflow-hidden">
                {["Overview", "Timeline", "Map", "Budget"].map((item) => (
                  <SkeletonPill
                    className="bg-slate-100 text-transparent ring-1 ring-slate-200"
                    key={item}
                  >
                    {item}
                  </SkeletonPill>
                ))}
              </div>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <SkeletonBlock className="h-[22rem]" />
                <div className="grid gap-3">
                  <SkeletonBlock className="h-28" />
                  <SkeletonBlock className="h-28" />
                  <SkeletonBlock className="h-28" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-busy="true"
      aria-label={resolvedTitle}
      className="relative isolate min-h-[38rem] overflow-hidden rounded-[2rem] bg-[#050816] p-4 text-white shadow-[0_28px_90px_rgba(2,6,23,0.24)] sm:p-5"
      data-testid="dashboard-loading-panel"
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_4%,rgba(255,255,255,0.16),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(249,115,22,0.18),transparent_25%),linear-gradient(180deg,#020617,#08111f_62%,#030712)]" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid gap-4">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.08] p-5 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-orange-300">
              {resolvedEyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-black leading-none tracking-tight sm:text-5xl">
              {resolvedTitle}
            </h1>
            <div className="mt-5 grid gap-3">
              <SkeletonLine className="h-3 w-11/12 bg-white/18" />
              <SkeletonLine className="h-3 w-7/12 bg-white/14" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ActionSkeleton icon={<Search aria-hidden="true" className="h-5 w-5" />} />
            <ActionSkeleton icon={<Sparkles aria-hidden="true" className="h-5 w-5" />} />
            <ActionSkeleton icon={<Plane aria-hidden="true" className="h-5 w-5" />} />
          </div>
          <SkeletonBlock className="h-[18rem] border-white/10 bg-white/[0.08]" />
        </div>
        <div className="grid content-start gap-3">
          <SkeletonBlock className="h-36 border-white/10 bg-white/[0.08]" />
          <SkeletonBlock className="h-36 border-white/10 bg-white/[0.08]" />
          <SkeletonBlock className="h-36 border-white/10 bg-white/[0.08]" />
        </div>
      </div>
    </section>
  );
}

function GlobeBackdrop({ compact = false }: { compact?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(56,189,248,0.16),transparent_22%),linear-gradient(180deg,#020617,#020617_46%,#000)]" />
      <div
        className={cn(
          "absolute left-1/2 rounded-full border border-sky-200/24 bg-[radial-gradient(circle_at_34%_20%,rgba(255,255,255,0.72),transparent_13%),radial-gradient(circle_at_48%_42%,rgba(34,197,94,0.52),transparent_18%),radial-gradient(circle_at_64%_56%,rgba(59,130,246,0.56),transparent_24%),linear-gradient(135deg,#2563eb,#0f766e_52%,#020617_78%)] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_60px_rgba(125,211,252,0.32)]",
          compact
            ? "top-[18%] h-[34rem] w-[34rem] -translate-x-1/2"
            : "top-[30%] h-[36rem] w-[36rem] -translate-x-1/2 sm:h-[44rem] sm:w-[44rem]"
        )}
      >
        <div className="absolute inset-0 rounded-full bg-[linear-gradient(96deg,rgba(0,0,0,0.28),transparent_44%,rgba(0,0,0,0.58))]" />
        <div className="absolute inset-x-16 top-7 h-5 rounded-full bg-sky-100/40 blur-md" />
      </div>
      <StarField />
    </div>
  );
}

function StarField() {
  return (
    <div className="absolute inset-0 opacity-75">
      <span className="absolute left-[8%] top-[13%] h-1 w-1 rounded-full bg-white/80" />
      <span className="absolute left-[24%] top-[22%] h-0.5 w-0.5 rounded-full bg-white/70" />
      <span className="absolute left-[46%] top-[10%] h-1 w-1 rounded-full bg-white/70" />
      <span className="absolute left-[72%] top-[18%] h-0.5 w-0.5 rounded-full bg-white/80" />
      <span className="absolute left-[88%] top-[34%] h-1 w-1 rounded-full bg-white/70" />
      <span className="absolute left-[18%] top-[48%] h-0.5 w-0.5 rounded-full bg-white/70" />
      <span className="absolute left-[64%] top-[54%] h-1 w-1 rounded-full bg-white/80" />
    </div>
  );
}

function FloatingMapControls() {
  return (
    <div className="absolute right-4 top-[calc(5.5rem+env(safe-area-inset-top))] z-20 overflow-hidden rounded-full border border-white/12 bg-black/68 p-1 text-white shadow-[0_18px_42px_rgba(0,0,0,0.38)] backdrop-blur-xl">
      <span className="grid h-11 w-11 place-items-center rounded-full">
        <Map aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="mx-auto block h-px w-7 bg-white/18" />
      <span className="grid h-11 w-11 place-items-center rounded-full">
        <Compass aria-hidden="true" className="h-5 w-5" />
      </span>
    </div>
  );
}

function CountryPin() {
  return (
    <div className="absolute left-1/2 top-[38%] z-20 -translate-x-1/2 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/92 text-sm font-black tracking-[0.14em] text-slate-950 shadow-[0_18px_48px_rgba(251,146,60,0.24)]">
        <span aria-hidden="true">US</span>
      </div>
      <div className="mx-auto h-9 w-px bg-orange-300/80" />
      <div className="mx-auto h-4 w-4 rotate-45 rounded-[0.2rem] bg-orange-300" />
    </div>
  );
}

function CollapsedWalletSkeleton({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-[2rem] bg-white px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 text-slate-950 shadow-[0_-24px_80px_rgba(0,0,0,0.34)] sm:mx-auto sm:max-w-[34rem] sm:rounded-[2rem]">
      <div className="mx-auto h-1.5 w-16 rounded-full bg-slate-300" />
      <div className="mt-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-orange-500">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-4xl font-black leading-none tracking-tight">
            {title}
          </h1>
        </div>
        <SkeletonCircle className="h-14 w-14 bg-orange-50" />
      </div>
      <div className="mt-8 grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] gap-3">
        <SkeletonCircle className="h-[4.5rem] w-[4.5rem]" />
        <SkeletonPill className="h-[4.5rem] bg-slate-100" />
        <SkeletonCircle className="h-[4.5rem] w-[4.5rem] bg-orange-500/90" />
      </div>
    </div>
  );
}

function ExpandedTripsSheet({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="absolute inset-x-0 top-8 z-20 min-h-[calc(100dvh-2rem)] rounded-t-[2rem] bg-white px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 text-slate-950 shadow-[0_-24px_80px_rgba(0,0,0,0.34)] lg:relative lg:top-auto lg:mx-auto lg:min-h-[42rem] lg:max-w-5xl lg:rounded-[2rem]">
      <div className="mx-auto h-1.5 w-16 rounded-full bg-slate-300" />
      <div className="mt-7 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.26em] text-orange-500">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-5xl font-black leading-none tracking-tight sm:text-6xl">
            {title}
          </h1>
        </div>
        <SkeletonCircle className="h-16 w-16 bg-orange-50" />
      </div>
      <SkeletonPill className="mt-8 h-12 w-28 bg-orange-50" />
      <div className="mt-8 flex items-center gap-4 text-slate-400">
        <SkeletonLine className="h-8 w-32" />
        <SkeletonLine className="h-px flex-1" />
      </div>
      <SkeletonBlock className="mt-6 h-[24rem] bg-slate-100" />
      <SkeletonBlock className="mt-5 h-56 bg-[linear-gradient(135deg,#9a3412,#6d28d9)]" />
    </div>
  );
}

function ActionSkeleton({ icon }: { icon: ReactNode }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.08] p-4">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-orange-400/12 text-orange-300">
        {icon}
      </span>
      <SkeletonLine className="mt-4 h-4 w-3/4 bg-white/18" />
      <SkeletonLine className="mt-2 h-3 w-1/2 bg-white/12" />
    </div>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[1.75rem] border border-slate-200 bg-slate-100",
        className
      )}
    />
  );
}

function SkeletonCircle({ className }: { className?: string }) {
  return (
    <div
      className={cn("shrink-0 animate-pulse rounded-full bg-slate-100", className)}
    />
  );
}

function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-full bg-slate-200", className)} />;
}

function SkeletonPill({
  children,
  className
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-full bg-slate-100 px-5 text-sm font-black",
        className
      )}
    >
      {children}
    </div>
  );
}
