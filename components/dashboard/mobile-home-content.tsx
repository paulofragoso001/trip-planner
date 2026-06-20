"use client";

import {
  Bell,
  BookOpen,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Cloud,
  CreditCard,
  Globe2,
  Languages,
  LifeBuoy,
  Mail,
  MessageSquare,
  PackageOpen,
  Plane,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Star,
  Upload,
  Wallet,
  X
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";
import type { DashboardRecentTripView } from "@/app/dashboard/loader";
import { cn } from "@/components/trip-ui";

type SheetState = "collapsed" | "expanded" | "settings";

export function MobileHomeContent({
  ideasWaitingCount,
  initialSheetState = "collapsed",
  primaryHref,
  primaryLabel,
  primaryMeta,
  recentTrips
}: {
  ideasWaitingCount: number;
  initialSheetState?: SheetState;
  primaryHref: string;
  primaryLabel: string;
  primaryMeta: string;
  recentTrips: DashboardRecentTripView[];
}) {
  const [sheetState, setSheetState] = useState<SheetState>(initialSheetState);
  const dragStartY = useRef<number | null>(null);
  const ignoreNextHandleClick = useRef(false);
  const isCollapsed = sheetState === "collapsed";
  const isExpanded = sheetState === "expanded";
  const isSettings = sheetState === "settings";
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setSheetState(initialSheetState);
  }, [initialSheetState]);

  function expandTrips() {
    setSheetState("expanded");
  }

  function collapseSheet() {
    setSheetState("collapsed");
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    dragStartY.current = event.clientY;
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const startY = dragStartY.current;
    dragStartY.current = null;

    if (startY === null) {
      return;
    }

    const deltaY = event.clientY - startY;
    if (Math.abs(deltaY) < 18) {
      setSheetState((current) => (current === "collapsed" ? "expanded" : "collapsed"));
      ignoreNextHandleClick.current = true;
      return;
    }

    setSheetState(deltaY < 0 ? "expanded" : "collapsed");
    ignoreNextHandleClick.current = true;
  }

  function handleHandleClick() {
    if (ignoreNextHandleClick.current) {
      ignoreNextHandleClick.current = false;
      return;
    }

    setSheetState((current) => (current === "collapsed" ? "expanded" : "collapsed"));
  }

  return (
    <section
      className="wayline-home-content-reveal pointer-events-auto relative z-10"
      data-sheet-state={sheetState}
      data-testid="mobile-home-wallet-content"
    >
      <div
        className={cn(
          "mx-auto overflow-hidden bg-white text-slate-950 shadow-[0_-24px_70px_rgba(0,0,0,0.34)] transition-[height,max-height,border-radius] duration-300 ease-out",
          isCollapsed
            ? "max-h-[11.25rem] w-full max-w-none rounded-t-[2rem] min-[390px]:rounded-t-[2.2rem]"
            : "h-[100dvh] min-h-[100dvh] max-h-[100dvh] w-full max-w-none rounded-t-[2rem] min-[390px]:rounded-t-[2.25rem]"
        )}
        data-testid="ios-launch-sheet"
      >
        <button
          type="button"
          aria-expanded={!isCollapsed}
          aria-controls="mobile-launch-expanded-menu"
          aria-label={isCollapsed ? "Expand trips sheet" : "Collapse trips sheet"}
          className="mx-auto grid h-7 w-24 place-items-center rounded-full focus:outline-none focus:ring-4 focus:ring-orange-300/20"
          data-testid="ios-launch-sheet-handle"
          onClick={handleHandleClick}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <span className="h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
        </button>

        {isSettings ? (
          <SettingsPanel onClose={collapseSheet} />
        ) : (
          <div
            id="mobile-launch-expanded-menu"
            className={cn("px-4 pb-4 min-[390px]:px-5", isCollapsed ? "pt-0" : "pt-0")}
          >
            <header className="flex items-start justify-between gap-3">
              <button
                type="button"
                aria-expanded={!isCollapsed}
                className="min-w-0 flex-1 text-left focus:outline-none focus:ring-4 focus:ring-orange-300/20"
                onClick={isCollapsed ? expandTrips : collapseSheet}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <h1 className="truncate text-[clamp(2.45rem,12vw,3.35rem)] font-black leading-none tracking-normal text-slate-950">
                    My Trips
                  </h1>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn("mt-2 h-6 w-6 shrink-0 text-slate-400 transition-transform", isExpanded && "rotate-180")}
                  />
                </span>
              </button>
              <button
                type="button"
                aria-label="Open settings"
                className="grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-full bg-orange-50 text-orange-500 transition hover:bg-orange-100 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
                onClick={() => setSheetState("settings")}
              >
                <Settings className="h-6 w-6" aria-hidden="true" />
              </button>
            </header>

            {isCollapsed ? (
              <CollapsedLauncher
                primaryHref={primaryHref}
                primaryLabel={primaryLabel}
                primaryMeta={primaryMeta}
              />
            ) : (
              <ExpandedTrips
                currentYear={currentYear}
                ideasWaitingCount={ideasWaitingCount}
                primaryHref={primaryHref}
                primaryLabel={primaryLabel}
                primaryMeta={primaryMeta}
                recentTrips={recentTrips}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function CollapsedLauncher({
  primaryHref,
  primaryLabel,
  primaryMeta
}: {
  primaryHref: string;
  primaryLabel: string;
  primaryMeta: string;
}) {
  return (
    <div className="mt-5" data-testid="mobile-home-actions">
      <div className="grid grid-cols-[3.8rem_minmax(0,1fr)_3.8rem] items-center gap-3" data-testid="mobile-home-compact-actions">
        <CircleAction href="/dashboard/search" icon={<Search />} label="Search" />
        <Link
          aria-label={primaryLabel}
          className="grid h-14 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-full bg-white px-4 text-left text-slate-950 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
          href={primaryHref}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-500 shadow-sm">
            <Plane className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.95rem] font-black">{primaryLabel}</span>
            <span className="block truncate text-[0.72rem] font-bold text-slate-500">{primaryMeta}</span>
          </span>
        </Link>
        <CircleAction href="/dashboard/trips#new-trip" icon={<Plus />} label="Add" primary />
      </div>
    </div>
  );
}

function ExpandedTrips({
  currentYear,
  ideasWaitingCount,
  primaryHref,
  primaryLabel,
  primaryMeta,
  recentTrips
}: {
  currentYear: number;
  ideasWaitingCount: number;
  primaryHref: string;
  primaryLabel: string;
  primaryMeta: string;
  recentTrips: DashboardRecentTripView[];
}) {
  const featuredTrip = recentTrips[0] || null;

  return (
    <div className="mt-5 h-[calc(100dvh-6.75rem)] overflow-y-auto pb-[calc(7rem+env(safe-area-inset-bottom))]" data-testid="ios-launch-sheet-expanded">
      <div className="inline-flex rounded-full bg-orange-50 px-4 py-2 text-xl font-black text-orange-500">
        {currentYear}
      </div>
      <div className="mt-8 flex items-center gap-3 text-xl text-slate-400">
        <span>Upcoming</span>
        <span className="h-px flex-1 bg-slate-300" aria-hidden="true" />
      </div>
      <TripFeatureCard
        href={featuredTrip?.href || primaryHref}
        name={featuredTrip?.destination || featuredTrip?.name || stripPrimaryLabel(primaryMeta) || primaryLabel}
        dateRange={featuredTrip?.dateRange || primaryMeta}
        status={featuredTrip?.status || ""}
      />
      <ProFeatureCard />
      <EmailAutomationCard />
      {ideasWaitingCount > 0 ? (
        <Link
          className="mt-5 grid min-h-[4.5rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.5rem] bg-orange-50 px-4 text-slate-950 ring-1 ring-orange-100"
          href="/dashboard/plan#ai-review"
        >
          <Sparkles className="h-6 w-6 text-orange-500" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-base font-black">Review places</span>
            <span className="block truncate text-sm font-semibold text-slate-500">
              {ideasWaitingCount} item{ideasWaitingCount === 1 ? "" : "s"} waiting
            </span>
          </span>
          <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
        </Link>
      ) : null}
      <div className="mt-5 grid grid-cols-[3.8rem_minmax(0,1fr)_3.8rem] items-center gap-3">
        <CircleAction href="/dashboard/search" icon={<Search />} label="Search" />
        <Link
          className="grid h-12 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-full bg-white px-4 font-black text-slate-950 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
          href="/dashboard/profile/stats"
        >
          <Globe2 className="h-5 w-5 shrink-0 text-slate-950" aria-hidden="true" />
          <span className="truncate">Travel Book</span>
        </Link>
        <CircleAction href="/dashboard/trips#new-trip" icon={<Plus />} label="Add" primary />
      </div>
    </div>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="h-[100dvh] overflow-y-auto bg-slate-100 px-5 pb-10 pt-3" data-testid="mobile-home-settings">
      <header className="relative min-h-24">
        <button
          type="button"
          aria-label="Close settings"
          className="absolute right-0 top-0 grid h-12 w-12 place-items-center rounded-full bg-white text-slate-950 shadow-sm focus:outline-none focus:ring-4 focus:ring-orange-300/20"
          onClick={onClose}
        >
          <X className="h-7 w-7" aria-hidden="true" />
        </button>
        <h2 className="pt-14 text-[2.6rem] font-black leading-none tracking-normal text-black">Settings</h2>
      </header>

      <ProSettingsCard />
      <SettingsGroup>
        <SettingsRow icon={<Cloud />} label="Save your trips" meta="Login or create an account" accentMeta />
        <SettingsRow icon={<SlidersHorizontal />} label="Custom Categories" />
      </SettingsGroup>

      <SettingsSection title="Automations">
        <SettingsRow icon={<Send />} label="Add Reservations via Email" pro />
        <SettingsRow icon={<CalendarDays />} label="Calendar Feed" pro />
        <SettingsRow icon={<PackageOpen />} label="Connect with Claude / MCP" />
        <SettingsRow icon={<Briefcase />} label="Shortcuts" />
        <SettingsRow icon={<Upload />} label="TripIt Importer" pro />
      </SettingsSection>

      <SettingsSection title="Customize">
        <SettingsRow icon={<RefreshCw />} label="Currency" value="US Dollar" picker />
        <SettingsRow icon={<SlidersHorizontal />} label="Distance Unit" value="Miles" picker />
        <SettingsRow icon={<Languages />} label="Language" value="English" picker />
        <SettingsRow icon={<Wallet />} label="Trips Timeline" />
        <SettingsRow icon={<BookOpen />} label="App Icon" />
        <SettingsRow icon={<Globe2 />} label="My Wayline Book" />
        <SettingsRow icon={<Bell />} label="Notifications" />
        <SettingsRow icon={<CreditCard />} label="Widgets" />
        <SettingsRow icon={<PackageOpen />} label="Storage and Data" />
      </SettingsSection>

      <SettingsSection title="Help Center">
        <SettingsRow icon={<LifeBuoy />} label="Need help?" />
        <SettingsRow icon={<Mail />} label="Talk to us" />
        <SettingsRow icon={<Star />} label="Review the App" />
        <SettingsRow icon={<Sparkles />} label="App Updates" />
        <SettingsRow icon={<Star />} label="Your Membership" />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsRow icon={<Briefcase />} label="About Wayline" />
        <SettingsRow icon={<MessageSquare />} label="Terms of Service" />
        <SettingsRow icon={<Shield />} label="Privacy Policy" />
        <SettingsRow icon={<Upload />} label="Share to a Friend" />
      </SettingsSection>

      <div className="mt-14 pb-4 text-center text-slate-400">
        <p className="text-2xl font-medium">Version: 1.0.0</p>
        <p className="mt-1 text-base font-medium">Last Sync: Never</p>
        <button className="mt-4 text-lg font-black text-orange-500" type="button">
          Force Sync
        </button>
      </div>
    </div>
  );
}

function TripFeatureCard({
  dateRange,
  href,
  name,
  status
}: {
  dateRange: string;
  href: string;
  name: string;
  status: string;
}) {
  return (
    <Link
      className="relative mt-6 block min-h-[20rem] overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#0891b2,#0f766e_45%,#1e293b)] p-6 text-white shadow-[0_22px_60px_rgba(15,23,42,0.18)]"
      href={href}
      data-testid="mobile-home-featured-trip"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_12%,rgba(255,255,255,0.45),transparent_18%),radial-gradient(circle_at_80%_22%,rgba(14,165,233,0.48),transparent_28%),linear-gradient(180deg,transparent_26%,rgba(15,23,42,0.72)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 p-6">
        <h3 className="text-[2.35rem] font-black leading-none tracking-normal">{name}</h3>
        <p className="mt-3 text-xl font-medium text-white/86">{dateRange}</p>
        {status ? <p className="text-lg font-medium text-white/72">{status}</p> : null}
      </div>
    </Link>
  );
}

function ProFeatureCard() {
  return (
    <section className="relative mt-6 overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#9f3d16,#7e255f_48%,#3510b7)] p-6 text-white">
      <button
        type="button"
        aria-label="Dismiss pro card"
        className="absolute right-5 top-5 text-white/45"
      >
        <X className="h-7 w-7" aria-hidden="true" />
      </button>
      <span className="inline-flex rounded-lg bg-white/70 px-2.5 py-1 text-sm font-black text-orange-900">PRO</span>
      <h3 className="mt-5 text-[1.55rem] font-black">Explore all the Pro features</h3>
      <p className="mt-3 text-[1.6rem] font-black leading-tight text-pink-300/70">
        Get flight update alerts, manage expenses, forward reservations and much
      </p>
      <button
        type="button"
        className="mt-6 h-14 w-full rounded-full bg-white/70 text-xl font-black text-black ring-2 ring-white/50"
      >
        Accept 15 Days Free
      </button>
    </section>
  );
}

function EmailAutomationCard() {
  return (
    <section className="mt-6 rounded-[1.75rem] bg-white p-6 ring-1 ring-slate-200" data-testid="mobile-home-email-card">
      <div className="flex justify-between gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-xl border-2 border-dashed border-orange-300 text-orange-500">
          <Mail className="h-8 w-8" aria-hidden="true" />
        </div>
        <button type="button" aria-label="Dismiss email automation card" className="self-start text-slate-400">
          <X className="h-7 w-7" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-5 text-sm font-black uppercase tracking-normal text-orange-500">Automation</p>
      <h3 className="mt-2 text-[1.55rem] font-black leading-tight">Add Reservations via Email</h3>
      <p className="mt-3 text-lg font-medium leading-snug text-slate-500">
        Let Wayline automatically create an itinerary based on your flight or hotel reservation.
      </p>
      <Link
        className="mt-5 grid h-14 place-items-center rounded-full bg-orange-50 text-lg font-black text-orange-500"
        href="/dashboard/imports"
      >
        Forward Your Reservation
      </Link>
    </section>
  );
}

function ProSettingsCard() {
  return (
    <section className="mt-7 rounded-[1.65rem] bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black">
            Wayline <span className="rounded-lg bg-orange-500 px-2 py-0.5 text-base text-white">PRO</span>
          </h3>
          <p className="mt-2 max-w-[15rem] text-xl leading-snug text-slate-400">
            Receive alerts for any updates on your flights: schedules, gate changes and terminal
          </p>
          <button type="button" className="mt-2 text-xl font-black text-orange-500">
            Redeem 7 Days Free
          </button>
        </div>
        <div className="grid h-20 w-20 place-items-center rounded-full bg-sky-400 text-white">
          <Plane className="h-9 w-9" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

function SettingsSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="mt-8">
      <h3 className="mb-3 px-5 text-xl font-medium uppercase tracking-normal text-slate-400">{title}</h3>
      <SettingsGroup>{children}</SettingsGroup>
    </section>
  );
}

function SettingsGroup({ children }: { children: ReactNode }) {
  return <div className="mt-5 overflow-hidden rounded-[1.65rem] bg-white">{children}</div>;
}

function SettingsRow({
  accentMeta = false,
  icon,
  label,
  meta,
  picker = false,
  pro = false,
  value
}: {
  accentMeta?: boolean;
  icon: ReactNode;
  label: string;
  meta?: string;
  picker?: boolean;
  pro?: boolean;
  value?: string;
}) {
  return (
    <button
      type="button"
      className="grid min-h-[4.35rem] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-slate-200 px-5 text-left last:border-b-0"
    >
      <span className="text-orange-500 [&_svg]:h-6 [&_svg]:w-6" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        {meta ? (
          <>
            <span className={cn("block text-lg", accentMeta ? "text-orange-500" : "text-slate-400")}>{meta}</span>
            <span className="block truncate text-xl font-medium text-black">{label}</span>
          </>
        ) : (
          <span className="block truncate text-xl font-medium text-black">{label}</span>
        )}
      </span>
      <span className="flex items-center gap-2 text-xl font-medium text-slate-400">
        {pro ? <span className="rounded-md bg-slate-400 px-2 py-0.5 text-sm font-black text-white">PRO</span> : null}
        {value ? <span>{value}</span> : null}
        {picker ? <ChevronDown className="h-5 w-5" aria-hidden="true" /> : <ChevronRight className="h-5 w-5" aria-hidden="true" />}
      </span>
    </button>
  );
}

function CircleAction({
  href,
  icon,
  label,
  primary = false
}: {
  href: string;
  icon: ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      aria-label={label}
      className={cn(
        "grid h-14 w-14 place-items-center rounded-full shadow-[0_18px_44px_rgba(15,23,42,0.08)] transition focus:outline-none focus:ring-4 focus:ring-orange-300/20",
        primary ? "bg-orange-500 text-white" : "bg-white text-slate-950 ring-1 ring-slate-100"
      )}
      href={href}
    >
      <span className="[&_svg]:h-7 [&_svg]:w-7" aria-hidden="true">
        {icon}
      </span>
    </Link>
  );
}

function stripPrimaryLabel(value: string) {
  return value.split("·")[0]?.trim();
}
