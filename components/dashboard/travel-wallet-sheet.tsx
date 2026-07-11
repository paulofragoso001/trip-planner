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
  Eye,
  FileText,
  List,
  Globe2,
  Languages,
  LifeBuoy,
  Luggage,
  Mail,
  MapPin,
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
import type { CSSProperties, PointerEvent, ReactNode, TouchEvent } from "react";
import type { DashboardRecentTripView } from "@/app/dashboard/loader";
import { cn } from "@/components/trip-ui";
import { dashboardActionRoutes } from "@/lib/dashboard/action-routes";
import type { WalletHeroImage } from "@/lib/wallet/hero-image";

type SheetState = "collapsed" | "expanded" | "settings" | "search";
type TravelWalletSurface = "home" | "trips";

type OverlaySearchResult = {
  href: string;
  id: string;
  subtitle: string | null;
  title: string;
  type: "activity" | "document" | "place" | "trip";
  updated_at: string | null;
};

const SHEET_RESTING_TRANSLATE = 60;
const SHEET_EXPANDED_TRANSLATE = 15;
const SHEET_DRAG_MIN_TRANSLATE = 10;
const SHEET_DRAG_MAX_TRANSLATE = 85;
const SHEET_SNAP_THRESHOLD = 35;
const SHEET_TOUCH_DRAG_THRESHOLD = 6;

export function TravelWalletSheet({
  featuredTripImage,
  forceExpanded = false,
  initialSheetState = "collapsed",
  onCreateTrip,
  primaryHref,
  primaryLabel,
  primaryMeta,
  recentTrips,
  surface = "home"
}: {
  featuredTripImage?: WalletHeroImage;
  forceExpanded?: boolean;
  initialSheetState?: SheetState;
  onCreateTrip?: () => void;
  primaryHref: string;
  primaryLabel: string;
  primaryMeta: string;
  recentTrips: DashboardRecentTripView[];
  surface?: TravelWalletSurface;
}) {
  const [sheetState, setSheetState] = useState<SheetState>(initialSheetState);
  const [trialSheetCopy, setTrialSheetCopy] = useState<string | null>(null);
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [touchTransform, setTouchTransform] = useState<number | null>(null);
  const [returnSheetState, setReturnSheetState] = useState<SheetState>(initialSheetState);
  const [showTripScopeMenu, setShowTripScopeMenu] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const ignoreNextHandleClick = useRef(false);
  const touchStartY = useRef<number | null>(null);
  const touchStartTransform = useRef(SHEET_RESTING_TRANSLATE);
  const activeTouchTransform = useRef(SHEET_RESTING_TRANSLATE);
  const hasActiveTouchDrag = useRef(false);
  const isCollapsed = sheetState === "collapsed";
  const isExpanded = sheetState === "expanded";
  const isSettings = sheetState === "settings";
  const isSearch = sheetState === "search";
  const currentYear = new Date().getFullYear();
  const isTripsSurface = surface === "trips";
  const isEmptyHomeLaunch = !isTripsSurface && recentTrips.length === 0;
  const hasHomeTrips = !isTripsSurface && recentTrips.length > 0;
  const sheetHandleLabel = isTripsSurface
    ? isCollapsed
      ? "Expand My Trips sheet"
      : "Collapse My Trips sheet"
    : isCollapsed
      ? "Expand trips sheet"
      : "Collapse trips sheet";

  useEffect(() => {
    setSheetState(initialSheetState);
  }, [initialSheetState]);

  useEffect(() => {
    if (forceExpanded) {
      setSheetState("expanded");
    }
  }, [forceExpanded]);

  function expandTrips() {
    setShowTripScopeMenu(false);
    setSheetState("expanded");
  }

  function collapseSheet() {
    setShowTripScopeMenu(false);
    setSheetState("collapsed");
  }

  function openSearch() {
    setShowTripScopeMenu(false);
    setReturnSheetState(isSettings || isSearch ? "collapsed" : sheetState);
    setSheetState("search");
  }

  function closeSearch() {
    setSheetState(returnSheetState === "search" || returnSheetState === "settings" ? "collapsed" : returnSheetState);
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

    setShowTripScopeMenu(false);
    setSheetState((current) => (current === "collapsed" ? "expanded" : "collapsed"));
  }

  function handleTripsTitleClick() {
    setShowTripScopeMenu(false);
    setSheetState(isCollapsed ? "expanded" : "collapsed");
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    if (isSettings || isSearch) {
      return;
    }

    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    const startingTransform = isExpanded || forceExpanded ? SHEET_EXPANDED_TRANSLATE : SHEET_RESTING_TRANSLATE;
    touchStartY.current = touch.clientY;
    touchStartTransform.current = startingTransform;
    activeTouchTransform.current = startingTransform;
    hasActiveTouchDrag.current = false;
  }

  function handleTouchMove(event: TouchEvent<HTMLElement>) {
    const touch = event.touches[0];
    const startY = touchStartY.current;
    if (!touch || startY === null) {
      return;
    }

    const deltaY = touch.clientY - startY;
    if (!hasActiveTouchDrag.current && Math.abs(deltaY) < SHEET_TOUCH_DRAG_THRESHOLD) {
      return;
    }

    event.preventDefault();

    if (!hasActiveTouchDrag.current) {
      hasActiveTouchDrag.current = true;
      setIsTouchDragging(true);
      setSheetState("expanded");
    }

    const viewportHeight = window.innerHeight || 1;
    const deltaPercent = (deltaY / viewportHeight) * 100;
    const nextTransform = Math.min(
      SHEET_DRAG_MAX_TRANSLATE,
      Math.max(SHEET_DRAG_MIN_TRANSLATE, touchStartTransform.current + deltaPercent)
    );

    activeTouchTransform.current = nextTransform;
    setTouchTransform(nextTransform);
  }

  function handleTouchEnd() {
    const shouldSnap = hasActiveTouchDrag.current;

    touchStartY.current = null;
    hasActiveTouchDrag.current = false;
    setIsTouchDragging(false);
    setTouchTransform(null);

    if (!shouldSnap) {
      return;
    }

    setSheetState(activeTouchTransform.current < SHEET_SNAP_THRESHOLD ? "expanded" : "collapsed");
    ignoreNextHandleClick.current = true;
  }

  const sheetDragStyle: CSSProperties | undefined =
    touchTransform === null ? undefined : { transform: `translateY(${touchTransform}%)` };

  return (
    <section
      className={cn(
        "wayline-home-content-reveal bottom-sheet-container native-map-web-interactive pointer-events-auto relative z-10 w-full transform-gpu transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]",
        forceExpanded && !isTouchDragging && "sheet-expand-up -translate-y-[15%]",
        isTouchDragging && "is-dragging !transition-none"
      )}
      data-sheet-surface={surface}
      data-sheet-state={sheetState}
      data-sheet-transform={touchTransform === null ? undefined : touchTransform.toFixed(2)}
      data-touch-dragging={isTouchDragging ? "true" : undefined}
      data-testid="mobile-home-wallet-content"
      id={surface === "home" ? "my-trips-sheet" : undefined}
      style={sheetDragStyle}
    >
      {isTripsSurface ? <span className="sr-only" data-testid="mobile-trips-sheet-content">My Trips sheet</span> : null}
      {isEmptyHomeLaunch && isCollapsed && showTripScopeMenu ? <TripScopeMenu /> : null}
      <div
        className={cn(
          "native-map-web-opaque relative mx-0 w-full overflow-hidden bg-white text-slate-950 shadow-[0_-24px_70px_rgba(0,0,0,0.34)] transition-[height,max-height,border-radius] duration-300 ease-out",
          isCollapsed
            ? cn(
                "rounded-t-[2rem] min-[390px]:rounded-t-[2.2rem]",
                isEmptyHomeLaunch
                  ? "h-[clamp(18rem,32dvh,21rem)] max-h-[clamp(18rem,32dvh,21rem)]"
                  : hasHomeTrips
                    ? "h-[clamp(13.75rem,24dvh,16rem)] max-h-[clamp(13.75rem,24dvh,16rem)]"
                    : "h-[clamp(10.6rem,21dvh,12.1rem)] max-h-[clamp(10.6rem,21dvh,12.1rem)]"
              )
            : "h-[100dvh] min-h-[100dvh] max-h-[100dvh] rounded-t-[2rem] min-[390px]:rounded-t-[2.25rem]"
        )}
        data-testid="ios-launch-sheet"
      >
        <button
          type="button"
          aria-expanded={!isCollapsed}
          aria-controls="mobile-launch-expanded-menu"
          aria-label={sheetHandleLabel}
          className="mx-auto grid h-7 w-24 touch-none place-items-center rounded-full focus:outline-none focus:ring-4 focus:ring-orange-300/20"
          data-testid="ios-launch-sheet-handle"
          onClick={handleHandleClick}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onTouchCancel={handleTouchEnd}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onTouchStart={handleTouchStart}
        >
          <span className="h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
        </button>

        {isSettings ? (
          <SettingsPanel
            onClose={collapseSheet}
            onOpenTrial={() =>
              setTrialSheetCopy("Your 15 day Almidy Pro trial will be available from billing settings soon.")
            }
          />
        ) : isSearch ? (
          <SearchOverlay onClose={closeSearch} />
        ) : (
          <div
            id="mobile-launch-expanded-menu"
            className={cn(
              "px-4 pb-4 min-[390px]:px-5",
              !isCollapsed && "pt-[max(2.25rem,calc(env(safe-area-inset-top)+0.75rem))]"
            )}
          >
            <header className="flex items-start justify-between gap-3">
              <button
                type="button"
                aria-controls={isEmptyHomeLaunch && isCollapsed ? "launch-trip-scope-menu" : undefined}
                aria-expanded={isEmptyHomeLaunch && isCollapsed ? showTripScopeMenu : !isCollapsed}
                aria-label={isEmptyHomeLaunch && isCollapsed ? "Choose trip list" : isCollapsed ? "Open My Trips" : "Collapse My Trips"}
                className="min-w-0 flex-1 text-left focus:outline-none focus:ring-4 focus:ring-orange-300/20"
                onClick={handleTripsTitleClick}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <h1 className="truncate text-[clamp(2.35rem,11.5vw,3.35rem)] font-black leading-none tracking-normal text-slate-950">
                    My Trips
                  </h1>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "mt-2 h-6 w-6 shrink-0 text-slate-400 transition-transform",
                      (isExpanded || showTripScopeMenu) && "rotate-180"
                    )}
                  />
                </span>
              </button>
              <button
                type="button"
                aria-label="Open settings"
                className="grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-full bg-orange-50 text-orange-500 transition hover:bg-orange-100 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
                onClick={() => {
                  setShowTripScopeMenu(false);
                  setSheetState("settings");
                }}
              >
                <Settings className="h-6 w-6" aria-hidden="true" />
              </button>
            </header>

            {isCollapsed ? (
              isEmptyHomeLaunch ? null : (
                <CollapsedLauncher
                  onCreateTrip={onCreateTrip}
                  onOpenSearch={openSearch}
                  primaryHref={primaryHref}
                  primaryLabel={primaryLabel}
                  primaryMeta={primaryMeta}
                  hasTrips={recentTrips.length > 0}
                  surface={surface}
                />
              )
            ) : recentTrips.length === 0 ? (
              <WelcomeGetStarted onCreateTrip={onCreateTrip} />
            ) : isTripsSurface ? (
              <ExpandedTripsNative
                onCreateTrip={onCreateTrip}
                primaryHref={primaryHref}
                primaryLabel={primaryLabel}
                primaryMeta={primaryMeta}
                recentTrips={recentTrips}
              />
            ) : (
              <ExpandedTrips
                currentYear={currentYear}
                featuredTripImage={featuredTripImage}
                primaryHref={primaryHref}
                primaryLabel={primaryLabel}
                primaryMeta={primaryMeta}
                recentTrips={recentTrips}
              />
            )}
          </div>
        )}
      </div>
      {trialSheetCopy ? (
        <TrialAvailabilitySheet
          message={trialSheetCopy}
          onClose={() => setTrialSheetCopy(null)}
        />
      ) : null}
    </section>
  );
}

function WelcomeGetStarted({ onCreateTrip }: { onCreateTrip?: () => void }) {
  const createActionClassName = "inline-flex min-h-14 items-center justify-center rounded-full bg-orange-500 px-5 text-center text-lg font-black text-white shadow-[0_18px_42px_rgba(249,115,22,0.28)] transition hover:bg-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-300/25";

  return (
    <div
      className="mt-5 h-[calc(100dvh-6.25rem)] overflow-y-auto pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
      data-testid="mobile-launch-welcome"
    >
      <section className="rounded-[1.75rem] border border-orange-200/70 bg-[linear-gradient(135deg,#fffaf7,#ffeadc)] px-5 py-6 text-slate-950 shadow-[0_22px_60px_rgba(249,115,22,0.12)]">
        <p className="text-sm font-black uppercase tracking-[0.12em] text-orange-500">Welcome</p>
        <h2 className="mt-3 text-[2.15rem] font-black leading-none tracking-normal text-black">
          Get Started
        </h2>
        <p className="mt-4 max-w-[17rem] text-[1.12rem] font-medium leading-snug text-slate-400 min-[390px]:max-w-[19rem] min-[390px]:text-[1.22rem]">
          Create your next trip and plan your itinerary, expenses, documents, and more
        </p>
        <div className="mt-7 grid gap-3">
          {onCreateTrip ? (
            <button
              className={createActionClassName}
              data-testid="mobile-launch-create-first-trip"
              onClick={onCreateTrip}
              type="button"
            >
              Create Your First Trip
            </button>
          ) : (
            <Link
              className={createActionClassName}
              data-testid="mobile-launch-create-first-trip"
              href={dashboardActionRoutes.trips.create}
            >
              Create Your First Trip
            </Link>
          )}
          <Link
            className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#eadfd8] px-5 text-center text-lg font-black text-black transition hover:bg-[#dfd2ca] focus:outline-none focus:ring-4 focus:ring-orange-300/20"
            href={dashboardActionRoutes.imports.forwardReservation}
          >
            Forward Your Reservation
          </Link>
          <Link
            className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#eadfd8] px-5 text-center text-lg font-black text-black transition hover:bg-[#dfd2ca] focus:outline-none focus:ring-4 focus:ring-orange-300/20"
            href={dashboardActionRoutes.plan.sampleMiami}
          >
            Explore Sample Trip
          </Link>
        </div>
      </section>
    </div>
  );
}

function TripScopeMenu() {
  return (
    <div
      className="absolute bottom-[calc(clamp(18rem,32dvh,21rem)-1.6rem)] left-3 z-20 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-[1.85rem] border border-white/55 bg-white/72 text-slate-950 shadow-[0_24px_70px_rgba(15,23,42,0.22)] backdrop-blur-2xl min-[390px]:left-4 min-[390px]:w-[19.2rem]"
      data-testid="launch-trip-scope-menu"
      id="launch-trip-scope-menu"
    >
      <button
        className="grid min-h-[5.6rem] w-full grid-cols-[3.6rem_minmax(0,1fr)] items-center gap-2 px-5 text-left transition hover:bg-white/55 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
        type="button"
      >
        <span className="grid h-10 w-10 place-items-center text-slate-950" aria-hidden="true">
          <Eye className="h-7 w-7" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[1.45rem] font-medium leading-tight text-black">Friends&apos; Trips</span>
          <span className="mt-1 block text-[1.02rem] font-medium leading-tight text-slate-500">
            All trips that you didn&apos;t travel together.
          </span>
        </span>
      </button>
      <Link
        className="grid min-h-[4.4rem] w-full grid-cols-[3.6rem_minmax(0,1fr)] items-center gap-2 px-5 text-left transition hover:bg-white/55 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
        href={dashboardActionRoutes.trips.list}
      >
        <span className="grid h-10 w-10 place-items-center text-slate-950" aria-hidden="true">
          <Briefcase className="h-7 w-7" />
        </span>
        <span className="truncate text-[1.45rem] font-medium leading-tight text-black">My Trips</span>
      </Link>
    </div>
  );
}

function CollapsedLauncher({
  hasTrips,
  onCreateTrip,
  onOpenSearch,
  primaryHref,
  primaryLabel,
  primaryMeta,
  pinned = false,
  surface
}: {
  hasTrips: boolean;
  onCreateTrip?: () => void;
  onOpenSearch: () => void;
  pinned?: boolean;
  primaryHref: string;
  primaryLabel: string;
  primaryMeta: string;
  surface: TravelWalletSurface;
}) {
  const searchHref = surface === "trips" ? `${dashboardActionRoutes.trips.list}?view=list` : "/dashboard/search";
  const searchLabel = surface === "trips" ? "List" : "Search";
  const primaryActionHref = hasTrips && surface === "home" ? dashboardActionRoutes.trips.stats : primaryHref;
  const primaryActionLabel = hasTrips && surface === "home" ? "My Almidy Book" : primaryLabel;
  const primaryActionMeta = hasTrips && surface === "home" ? "" : primaryMeta;
  const primaryActionIcon = hasTrips && surface === "home" ? <Globe2 className="h-5 w-5" aria-hidden="true" /> : <Plane className="h-5 w-5" aria-hidden="true" />;

  return (
    <div
      className={cn(
        pinned
          ? "absolute inset-x-4 bottom-[calc(1.05rem+env(safe-area-inset-bottom))] min-[390px]:inset-x-5"
          : "mt-4"
      )}
      data-testid="ios-launch-sheet-collapsed"
    >
      <div data-testid="mobile-home-actions">
        <div className="grid grid-cols-[3.8rem_minmax(0,1fr)_3.8rem] items-center gap-3" data-testid="mobile-home-compact-actions">
          {surface === "trips" ? (
            <CircleAction href={searchHref} icon={<List />} label={searchLabel} />
          ) : (
            <CircleActionButton icon={<Search />} label={searchLabel} onClick={onOpenSearch} />
          )}
          {onCreateTrip && primaryActionLabel.toLowerCase().includes("create") ? (
            <button
              aria-label={primaryActionLabel}
              className="grid h-14 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-full bg-white px-4 text-left text-slate-950 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
              onClick={onCreateTrip}
              type="button"
            >
              <CollapsedLauncherPrimaryContent icon={primaryActionIcon} primaryLabel={primaryActionLabel} primaryMeta={primaryActionMeta} />
            </button>
          ) : (
            <Link
              aria-label={primaryActionLabel}
              className="grid h-14 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-full bg-white px-4 text-left text-slate-950 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
              href={primaryActionHref}
            >
              <CollapsedLauncherPrimaryContent icon={primaryActionIcon} primaryLabel={primaryActionLabel} primaryMeta={primaryActionMeta} />
            </Link>
          )}
          {onCreateTrip ? (
            <CircleActionButton
              icon={<Plus />}
              label="Add"
              onClick={onCreateTrip}
              primary
              testId="mobile-launch-add-trip"
            />
          ) : (
            <CircleAction href={dashboardActionRoutes.trips.create} icon={<Plus />} label="Add" primary />
          )}
        </div>
      </div>
    </div>
  );
}

function CollapsedLauncherPrimaryContent({
  icon,
  primaryLabel,
  primaryMeta
}: {
  icon: ReactNode;
  primaryLabel: string;
  primaryMeta: string;
}) {
  return (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-500 shadow-sm">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[0.95rem] font-black">{primaryLabel}</span>
        {primaryMeta ? <span className="block truncate text-[0.72rem] font-bold text-slate-500">{primaryMeta}</span> : null}
      </span>
    </>
  );
}

function ExpandedTripsNative({
  onCreateTrip,
  primaryHref,
  primaryLabel,
  primaryMeta,
  recentTrips
}: {
  onCreateTrip?: () => void;
  primaryHref: string;
  primaryLabel: string;
  primaryMeta: string;
  recentTrips: DashboardRecentTripView[];
}) {
  const featuredTrip = recentTrips[0] || null;
  const secondaryTrips = recentTrips.slice(1, 4);

  return (
    <div
      className="mt-5 h-[calc(100dvh-6.25rem)] overflow-y-auto pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
      data-testid="mobile-trips-sheet-expanded"
    >
      <div className="inline-flex rounded-full bg-orange-50 px-4 py-2 text-xl font-black text-orange-500">
        Trip Passes
      </div>
      <div className="mt-8 flex items-center gap-3 text-xl text-slate-400">
        <span>Ready to open</span>
        <span className="h-px flex-1 bg-slate-300" aria-hidden="true" />
      </div>
      <TripFeatureCard
        href={featuredTrip?.href || primaryHref}
        name={featuredTrip?.destination || featuredTrip?.name || stripPrimaryLabel(primaryMeta) || primaryLabel}
        dateRange={featuredTrip?.dateRange || primaryMeta}
        status={featuredTrip?.status || ""}
      />
      <TripsNativeActions onCreateTrip={onCreateTrip} />
      {secondaryTrips.length ? (
        <section className="mt-5 grid gap-3" aria-label="Recent trips">
          {secondaryTrips.map((trip) => (
            <Link
              className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[1.45rem] bg-slate-50 px-4 text-slate-950 ring-1 ring-slate-200 transition hover:bg-orange-50 hover:ring-orange-100 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
              href={trip.href}
              key={trip.id}
            >
              <span className="min-w-0">
                <span className="block truncate text-lg font-black">{trip.name}</span>
                <span className="mt-1 block truncate text-sm font-bold text-slate-500">
                  {trip.destination} · {trip.dateRange}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </Link>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function TripsNativeActions({ onCreateTrip }: { onCreateTrip?: () => void }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3" data-testid="mobile-trips-native-actions">
      {onCreateTrip ? (
        <SheetActionButton
          icon={<Plus />}
          label="Create trip"
          meta="Start a new pass"
          onClick={onCreateTrip}
        />
      ) : (
        <SheetActionLink
          href={dashboardActionRoutes.trips.create}
          icon={<Plus />}
          label="Create trip"
          meta="Start a new pass"
        />
      )}
      <SheetActionLink
        href={dashboardActionRoutes.trips.stats}
        icon={<Globe2 />}
        label="Travel Book"
        meta="Stats and countries"
      />
      <SheetActionLink
        href={`${dashboardActionRoutes.trips.list}?view=list`}
        icon={<Wallet />}
        label="Trip list"
        meta="Search and manage"
      />
      <SheetActionLink
        href={dashboardActionRoutes.plan.addIdea}
        icon={<Sparkles />}
        label="Add idea"
        meta="Save a place"
      />
    </div>
  );
}

function ExpandedTrips({
  currentYear,
  featuredTripImage,
  primaryHref,
  primaryLabel,
  primaryMeta,
  recentTrips
}: {
  currentYear: number;
  featuredTripImage?: WalletHeroImage;
  primaryHref: string;
  primaryLabel: string;
  primaryMeta: string;
  recentTrips: DashboardRecentTripView[];
}) {
  const featuredTrip = recentTrips[0] || null;
  const [showEmailAutomation, setShowEmailAutomation] = useState(true);

  return (
    <div className="mt-5 h-[calc(100dvh-6.25rem)] overflow-y-auto pb-[calc(6.5rem+env(safe-area-inset-bottom))]" data-testid="ios-launch-sheet-expanded">
      <div className="inline-flex rounded-full bg-orange-50 px-4 py-2 text-xl font-black text-orange-500">
        {currentYear}
      </div>
      <div className="mt-8 flex items-center gap-3 text-xl text-slate-400">
        <span>Upcoming</span>
        <span className="h-px flex-1 bg-slate-300" aria-hidden="true" />
      </div>
      <TripFeatureCard
        href={featuredTrip?.href || primaryHref}
        imageAlt={featuredTripImage?.imageAlt}
        imageUrl={featuredTripImage?.imageUrl}
        name={featuredTrip?.destination || featuredTrip?.name || stripPrimaryLabel(primaryMeta) || primaryLabel}
        dateRange={featuredTrip?.dateRange || primaryMeta}
        status={featuredTrip ? tripRelativeStatus(featuredTrip) : ""}
      />
      {showEmailAutomation ? (
        <EmailAutomationCard onDismiss={() => setShowEmailAutomation(false)} />
      ) : null}
      <div className="mt-5 grid grid-cols-[3.8rem_minmax(0,1fr)_3.8rem] items-center gap-3">
        <CircleAction href="/dashboard/search" icon={<Search />} label="Search" />
        <Link
          className="grid h-12 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-full bg-white px-4 font-black text-slate-950 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
          href={dashboardActionRoutes.trips.stats}
        >
          <Globe2 className="h-5 w-5 shrink-0 text-slate-950" aria-hidden="true" />
          <span className="truncate">My Almidy Book</span>
        </Link>
        <CircleAction href={dashboardActionRoutes.trips.create} icon={<Plus />} label="Add" primary />
      </div>
    </div>
  );
}

function PlanActionsGrid({ ideasWaitingCount }: { ideasWaitingCount: number }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3" data-testid="mobile-home-plan-actions">
      <SheetActionLink
        href={dashboardActionRoutes.plan.addIdea}
        icon={<Plus />}
        label="Add idea"
        meta="Save a note, link, or place"
      />
      <SheetActionLink
        href={dashboardActionRoutes.plan.reviewPlaces}
        icon={<Sparkles />}
        label="Review places"
        meta={
          ideasWaitingCount > 0
            ? `${ideasWaitingCount} item${ideasWaitingCount === 1 ? "" : "s"} waiting`
            : "Promote saved ideas"
        }
      />
    </div>
  );
}

function SheetActionLink({
  href,
  icon,
  label,
  meta
}: {
  href: string;
  icon: ReactNode;
  label: string;
  meta: string;
}) {
  return (
    <Link
      className="grid min-h-[5.5rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.45rem] bg-slate-50 px-4 text-left text-slate-950 ring-1 ring-slate-200 transition hover:bg-orange-50 hover:ring-orange-100 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
      href={href}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-orange-500 shadow-sm [&_svg]:h-6 [&_svg]:w-6" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-lg font-black">{label}</span>
        <span className="block truncate text-sm font-bold text-slate-500">{meta}</span>
      </span>
      <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
    </Link>
  );
}

function SheetActionButton({
  icon,
  label,
  meta,
  onClick
}: {
  icon: ReactNode;
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      className="grid min-h-[5.5rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.45rem] bg-slate-50 px-4 text-left text-slate-950 ring-1 ring-slate-200 transition hover:bg-orange-50 hover:ring-orange-100 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
      onClick={onClick}
      type="button"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-orange-500 shadow-sm [&_svg]:h-6 [&_svg]:w-6" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-lg font-black">{label}</span>
        <span className="block truncate text-sm font-bold text-slate-500">{meta}</span>
      </span>
      <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
    </button>
  );
}

function SettingsPanel({
  onClose,
  onOpenTrial
}: {
  onClose: () => void;
  onOpenTrial: () => void;
}) {
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
        <Link
          className="mt-5 inline-flex min-h-11 items-center rounded-full bg-white px-4 text-base font-black text-slate-950 shadow-sm ring-1 ring-slate-200"
          href={dashboardActionRoutes.settings.account}
        >
          Account settings
        </Link>
      </header>

      <ProSettingsCard onOpenTrial={onOpenTrial} />
      <SettingsGroup>
        <SettingsRow
          accentMeta
          href={dashboardActionRoutes.settings.account}
          icon={<Cloud />}
          label="Save your trips"
          meta="Login or create an account"
        />
        <SettingsRow icon={<SlidersHorizontal />} label="Custom Categories" unavailableLabel="Soon" />
      </SettingsGroup>

      <SettingsSection title="Automations">
        <SettingsRow href={dashboardActionRoutes.imports.forwardReservation} icon={<Send />} label="Add Reservations via Email" pro />
        <SettingsRow icon={<CalendarDays />} label="Calendar Feed" pro unavailableLabel="Pro soon" />
        <SettingsRow icon={<PackageOpen />} label="Connect with Claude / MCP" unavailableLabel="Soon" />
        <SettingsRow icon={<Briefcase />} label="Shortcuts" unavailableLabel="Soon" />
        <SettingsRow href={dashboardActionRoutes.imports.importSources} icon={<Upload />} label="TripIt Importer" pro />
      </SettingsSection>

      <SettingsSection title="Customize">
        <SettingsRow icon={<RefreshCw />} label="Currency" value="US Dollar" picker unavailableLabel="Soon" />
        <SettingsRow icon={<SlidersHorizontal />} label="Distance Unit" value="Miles" picker unavailableLabel="Soon" />
        <SettingsRow icon={<Languages />} label="Language" value="English" picker unavailableLabel="Soon" />
        <SettingsRow href={dashboardActionRoutes.trips.list} icon={<Wallet />} label="Trips Timeline" />
        <SettingsRow icon={<BookOpen />} label="App Icon" unavailableLabel="Soon" />
        <SettingsRow href={dashboardActionRoutes.trips.stats} icon={<Globe2 />} label="My Almidy Book" />
        <SettingsRow icon={<Bell />} label="Notifications" unavailableLabel="Soon" />
        <SettingsRow icon={<CreditCard />} label="Widgets" unavailableLabel="Soon" />
        <SettingsRow icon={<PackageOpen />} label="Storage and Data" unavailableLabel="Soon" />
      </SettingsSection>

      <SettingsSection title="Help Center">
        <SettingsRow href={dashboardActionRoutes.settings.help} icon={<LifeBuoy />} label="Need help?" />
        <SettingsRow href={dashboardActionRoutes.settings.talkToUs} icon={<Mail />} label="Talk to us" />
        <SettingsRow icon={<Star />} label="Review the App" unavailableLabel="Soon" />
        <SettingsRow icon={<Sparkles />} label="App Updates" unavailableLabel="Soon" />
        <SettingsRow href={dashboardActionRoutes.settings.membership} icon={<Star />} label="Your Membership" />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsRow href={dashboardActionRoutes.settings.about} icon={<Briefcase />} label="About Almidy" />
        <SettingsRow href={dashboardActionRoutes.settings.terms} icon={<MessageSquare />} label="Terms of Service" />
        <SettingsRow href={dashboardActionRoutes.settings.privacy} icon={<Shield />} label="Privacy Policy" />
        <SettingsRow icon={<Upload />} label="Share to a Friend" unavailableLabel="Soon" />
      </SettingsSection>

      <div className="mt-14 pb-4 text-center text-slate-400">
        <p className="text-2xl font-medium">Version: 1.0.0</p>
        <p className="mt-1 text-base font-medium">Last Sync: Never</p>
        <button
          aria-disabled="true"
          className="mt-4 cursor-not-allowed text-lg font-black text-slate-400"
          disabled
          type="button"
        >
          Force Sync
        </button>
        <p className="mt-1 text-sm font-bold text-slate-400">Sync is unavailable until connected services are enabled.</p>
      </div>
    </div>
  );
}

function TripFeatureCard({
  dateRange,
  href,
  imageAlt,
  imageUrl,
  name,
  status
}: {
  dateRange: string;
  href: string;
  imageAlt?: string | null;
  imageUrl?: string | null;
  name: string;
  status: string;
}) {
  return (
    <Link
      className="relative mt-6 block min-h-[20rem] overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#0891b2,#0f766e_45%,#1e293b)] p-6 text-white shadow-[0_22px_60px_rgba(15,23,42,0.18)]"
      href={href}
      data-testid="mobile-home-featured-trip"
    >
      {imageUrl ? (
        <img
          alt={imageAlt || ""}
          className="absolute inset-0 h-full w-full object-cover"
          src={imageUrl}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_12%,rgba(255,255,255,0.45),transparent_18%),radial-gradient(circle_at_80%_22%,rgba(14,165,233,0.48),transparent_28%),linear-gradient(135deg,#0891b2,#0f766e_45%,#1e293b)]" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.03)_0%,rgba(15,23,42,0.14)_38%,rgba(15,23,42,0.70)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 p-6">
        <h3 className="text-[2.35rem] font-black leading-none tracking-normal">{name}</h3>
        <p className="mt-3 text-xl font-medium text-white/86">{dateRange}</p>
        {status ? <p className="text-lg font-medium text-white/72">{status}</p> : null}
      </div>
    </Link>
  );
}

function ProFeatureCard({
  onDismiss,
  onOpenTrial
}: {
  onDismiss: () => void;
  onOpenTrial: () => void;
}) {
  return (
    <section className="relative mt-6 overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#9f3d16,#7e255f_48%,#3510b7)] p-6 text-white">
      <button
        type="button"
        aria-label="Dismiss pro card"
        className="absolute right-5 top-5 text-white/45"
        onClick={onDismiss}
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
        onClick={onOpenTrial}
      >
        Accept 15 Days Free
      </button>
    </section>
  );
}

function EmailAutomationCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section className="mt-6 rounded-[1.75rem] bg-white p-6 ring-1 ring-slate-200" data-testid="mobile-home-email-card">
      <div className="flex justify-between gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-xl border-2 border-dashed border-orange-300 text-orange-500">
          <Mail className="h-8 w-8" aria-hidden="true" />
        </div>
        <button
          type="button"
          aria-label="Dismiss email automation card"
          className="self-start text-slate-400"
          onClick={onDismiss}
        >
          <X className="h-7 w-7" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-5 text-sm font-black uppercase tracking-normal text-orange-500">Automation</p>
      <h3 className="mt-2 text-[1.55rem] font-black leading-tight">Add Reservations via Email</h3>
      <p className="mt-3 text-lg font-medium leading-snug text-slate-500">
        Let Almidy automatically create an itinerary based on your flight or hotel reservation.
      </p>
      <Link
        className="mt-5 grid h-14 place-items-center rounded-full bg-orange-50 text-lg font-black text-orange-500"
        href={dashboardActionRoutes.imports.forwardReservation}
      >
        Forward Your Reservation
      </Link>
    </section>
  );
}

function ProSettingsCard({ onOpenTrial }: { onOpenTrial: () => void }) {
  return (
    <section className="mt-7 rounded-[1.65rem] bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black">
            Almidy <span className="rounded-lg bg-orange-500 px-2 py-0.5 text-base text-white">PRO</span>
          </h3>
          <p className="mt-2 max-w-[15rem] text-xl leading-snug text-slate-400">
            Receive alerts for any updates on your flights: schedules, gate changes and terminal
          </p>
          <button
            type="button"
            className="mt-2 text-xl font-black text-orange-500"
            onClick={onOpenTrial}
          >
            Redeem 15 Days Free
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
  href,
  icon,
  label,
  meta,
  picker = false,
  pro = false,
  unavailableLabel,
  value
}: {
  accentMeta?: boolean;
  href?: string;
  icon: ReactNode;
  label: string;
  meta?: string;
  picker?: boolean;
  pro?: boolean;
  unavailableLabel?: string;
  value?: string;
}) {
  const content = (
    <>
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
        {unavailableLabel ? (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-sm font-black text-slate-500">
            {unavailableLabel}
          </span>
        ) : null}
        {value ? <span>{value}</span> : null}
        {picker && !unavailableLabel ? <ChevronDown className="h-5 w-5" aria-hidden="true" /> : null}
        {!unavailableLabel ? <ChevronRight className="h-5 w-5" aria-hidden="true" /> : null}
      </span>
    </>
  );
  const className = cn(
    "grid min-h-[4.35rem] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-slate-200 px-5 text-left last:border-b-0",
    unavailableLabel ? "cursor-not-allowed opacity-70" : "transition hover:bg-slate-50"
  );

  if (href && !unavailableLabel) {
    return (
      <Link className={className} href={href}>
        {content}
      </Link>
    );
  }

  return (
    <button
      aria-disabled="true"
      className={className}
      disabled
      type="button"
    >
      {content}
    </button>
  );
}

function TrialAvailabilitySheet({
  message,
  onClose
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 rounded-[1.75rem] bg-white p-5 text-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.3)] ring-1 ring-slate-200"
      role="dialog"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-500">Almidy Pro</p>
          <h2 className="mt-2 text-2xl font-black">Trial activation coming soon</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{message}</p>
        </div>
        <button
          aria-label="Close trial availability"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600"
          onClick={onClose}
          type="button"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <Link
        className="mt-4 grid min-h-12 place-items-center rounded-full bg-slate-950 px-5 text-sm font-black text-white"
        href={dashboardActionRoutes.settings.account}
      >
        Open account settings
      </Link>
    </div>
  );
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OverlaySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, 300);
  const normalizedQuery = debouncedQuery.trim();

  useEffect(() => {
    if (normalizedQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetch(`/api/v1/search?q=${encodeURIComponent(normalizedQuery)}`, {
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Search failed");
        }
        return response.json() as Promise<{ results?: OverlaySearchResult[] }>;
      })
      .then((payload) => {
        setResults(Array.isArray(payload.results) ? payload.results : []);
      })
      .catch((searchError: unknown) => {
        if (searchError instanceof DOMException && searchError.name === "AbortError") {
          return;
        }
        setError("Search is unavailable right now.");
        setResults([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [normalizedQuery]);

  const showEmptyState = normalizedQuery.length < 2 || (!isLoading && results.length === 0);

  return (
    <section
      className="flex h-[100dvh] flex-col bg-[#121214] px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[calc(0.9rem+env(safe-area-inset-top))] text-white"
      data-testid="mobile-sheet-search"
    >
      <div className="flex items-center gap-3">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search saved activities and documents</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8e8e93]"
          />
          <input
            autoComplete="off"
            autoFocus
            aria-autocomplete="list"
            aria-controls="mobile-sheet-search-autocomplete"
            className="h-12 w-full rounded-xl border border-orange-400/70 bg-[#1e1e22] pl-11 pr-3 text-[16px] font-semibold leading-none text-white outline-none placeholder:text-[#8e8e93] focus:border-orange-300 focus:ring-4 focus:ring-orange-400/15"
            data-testid="mobile-sheet-search-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search saved activities and documents"
            type="search"
            value={query}
          />
        </label>
        <button
          className="shrink-0 rounded-xl px-1 py-2.5 text-[16px] font-semibold text-orange-400 outline-none transition hover:text-orange-300 focus:ring-4 focus:ring-orange-400/15"
          data-testid="mobile-sheet-search-cancel"
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>
      </div>

      {isLoading ? (
        <div className="grid flex-1 place-items-center" data-testid="mobile-sheet-search-loading">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
        </div>
      ) : showEmptyState ? (
        <div className="grid flex-1 place-items-center px-8 text-center" data-testid="mobile-sheet-search-empty">
          <div>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/[0.06] text-orange-300">
              <Search className="h-8 w-8" aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-xl font-black text-white">No results found</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#8e8e93]">
              Try searching a place, activity, document, or trip.
            </p>
            {error ? <p className="mt-3 text-sm font-semibold text-orange-200">{error}</p> : null}
          </div>
        </div>
      ) : (
        <div
          aria-label="Search autocomplete suggestions"
          className="mt-4 min-h-0 flex-1 overflow-y-auto"
          data-testid="mobile-sheet-search-results"
          id="mobile-sheet-search-autocomplete"
          role="listbox"
        >
          {results.map((result) => (
            <a
              className="grid min-h-[4.75rem] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-white/10 py-3 text-left outline-none transition hover:bg-white/[0.04] focus:bg-white/[0.055] focus:ring-4 focus:ring-orange-400/15"
              href={result.href}
              key={result.id}
              role="option"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-orange-400/15 text-orange-300">
                {result.type === "document" ? (
                  <FileText className="h-5 w-5" aria-hidden="true" />
                ) : result.type === "trip" ? (
                  <Luggage className="h-5 w-5" aria-hidden="true" />
                ) : result.type === "place" ? (
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0">
                <span className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-orange-300">
                  {result.type}
                </span>
                <span className="mt-0.5 block truncate text-[1rem] font-black text-white">{result.title}</span>
                {result.subtitle ? (
                  <span className="mt-1 block truncate text-sm font-semibold text-[#9c9ba2]">{result.subtitle}</span>
                ) : null}
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
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

function CircleActionButton({
  icon,
  label,
  onClick,
  primary = false,
  testId
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
  testId?: string;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "grid h-14 w-14 place-items-center rounded-full shadow-[0_18px_44px_rgba(15,23,42,0.08)] transition focus:outline-none focus:ring-4 focus:ring-orange-300/20",
        primary ? "bg-orange-500 text-white" : "bg-white text-slate-950 ring-1 ring-slate-100"
      )}
      data-testid={testId}
      onClick={onClick}
      type="button"
    >
      <span className="[&_svg]:h-7 [&_svg]:w-7" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}

function stripPrimaryLabel(value: string) {
  return value.split("·")[0]?.trim();
}

function tripRelativeStatus(trip: DashboardRecentTripView) {
  const startDate = parseLocalDate(trip.startDate);
  const endDate = parseLocalDate(trip.endDate);

  if (!startDate) {
    return trip.status || "";
  }

  const today = startOfLocalDay(new Date());
  const dayDifference = Math.round((startDate.getTime() - today.getTime()) / 86_400_000);

  if (dayDifference === 0) {
    return "Starts today";
  }

  if (dayDifference === 1) {
    return "Starts tomorrow";
  }

  if (dayDifference > 1 && dayDifference < 14) {
    return `Starts in ${dayDifference} days`;
  }

  if (dayDifference < 0 && (!endDate || endDate.getTime() >= today.getTime())) {
    return "In progress";
  }

  return trip.status || "";
}

function parseLocalDate(value: string | null) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
