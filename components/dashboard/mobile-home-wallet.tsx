"use client";

import { Check, LocateFixed, Map, ImageIcon, MapPin, Upload } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, MouseEvent, ReactNode, TouchEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { DashboardData } from "@/app/dashboard/loader";
import { AlmidyLaunchGlobe } from "@/components/dashboard/almidy-launch-globe";
import { MobileGlobeWalletShell } from "@/components/dashboard/mobile-globe-wallet-shell";
import { TravelWalletSheet } from "@/components/dashboard/travel-wallet-sheet";
import { TripCreateForm, type TripDraft, type WalletLayer } from "@/components/dashboard/trip-create-form";
import { cn } from "@/components/trip-ui";
import { dashboardActionRoutes } from "@/lib/dashboard/action-routes";
import type { WalletHeroImage } from "@/lib/wallet/hero-image";
import { mobileGlobeWalletEnabled, unifiedMapSurfaceEnabled } from "@/lib/map/feature-flags";
import { useUnifiedMap } from "@/lib/map/unified-map-provider";
import { countryCodeToFlag } from "@/lib/map/wayline-map-pins";
import type { MobileWalletViewModel } from "@/lib/mobile-globe-wallet/view-model";

const DASHBOARD_WALLET_HISTORY_KEY = "__almidyDashboardWalletLayer";

function readWalletLayerFromHistory(state: unknown): WalletLayer {
  if (!state || typeof state !== "object") {
    return "myTrips";
  }

  const layer = (state as Record<string, unknown>)[DASHBOARD_WALLET_HISTORY_KEY];
  return layer === "createTrip" || layer === "datePicker" || layer === "backgroundPicker"
    ? layer
    : "myTrips";
}

type MobileHomeWalletProps = Pick<DashboardData, "metrics" | "recentTrips"> & {
  className?: string;
  heroImage?: WalletHeroImage;
  initialSheetState?: "collapsed" | "expanded";
  mobileWallet?: MobileWalletViewModel;
};

export function MobileHomeWallet({
  className,
  heroImage,
  initialSheetState = "collapsed",
  mobileWallet,
  recentTrips
}: MobileHomeWalletProps) {
  const latestTrip = recentTrips[0] || null;
  const resolvedInitialSheetState = initialSheetState;
  const [isCreatingFirstTrip, setIsCreatingFirstTrip] = useState(false);
  const primaryHref = latestTrip ? latestTrip.href : "/dashboard/trips?view=list#new-trip";
  const primaryLabel = latestTrip ? "Continue trip" : "Create trip";
  const primaryMeta = latestTrip
    ? `${latestTrip.name} · ${latestTrip.destination}`
    : "Start a new travel wallet.";
  const [walletLayer, setWalletLayer] = useState<WalletLayer>("myTrips");
  const [draft, setDraft] = useState<TripDraft>(emptyTripDraft);
  const walletHistoryDepth = useRef(0);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const nextLayer = readWalletLayerFromHistory(event.state);
      walletHistoryDepth.current = Math.max(0, walletHistoryDepth.current - 1);
      setWalletLayer(nextLayer);
      setIsCreatingFirstTrip(nextLayer !== "myTrips");
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (window.location.hash !== "#new-trip") return;

    setWalletLayer("createTrip");
    setIsCreatingFirstTrip(true);
  }, []);

  function pushWalletLayer(nextLayer: Exclude<WalletLayer, "myTrips">) {
    if (typeof window !== "undefined") {
      const currentState =
        window.history.state && typeof window.history.state === "object" ? window.history.state : {};
      window.history.pushState(
        {
          ...currentState,
          [DASHBOARD_WALLET_HISTORY_KEY]: nextLayer
        },
        "",
        window.location.href
      );
      walletHistoryDepth.current += 1;
    }

    setIsCreatingFirstTrip(true);
    setWalletLayer(nextLayer);
  }

  function popWalletLayer(fallbackLayer: WalletLayer) {
    if (typeof window !== "undefined" && walletHistoryDepth.current > 0) {
      window.history.back();
      return;
    }

    setWalletLayer(fallbackLayer);
    setIsCreatingFirstTrip(fallbackLayer !== "myTrips");
  }

  function pushCreateTrip() {
    pushWalletLayer("createTrip");
  }

  function popToMyTrips() {
    popWalletLayer("myTrips");
  }

  function popToCreateTrip() {
    popWalletLayer("createTrip");
  }

  function requestCurrentLocation() {
    window.dispatchEvent(new Event(dashboardActionRoutes.globe.locateUserEvent));
  }

  const walletSurface = (
    <section
      className={cn(
        "mobile-launch-globe native-map-surface-shell relative isolate h-[100dvh] overflow-hidden bg-black text-white lg:hidden",
        className
      )}
      data-mobile-wallet-active-layer={mobileWallet?.activeLayer.kind ?? "legacy-launch"}
      data-mobile-globe-wallet-rollout={mobileGlobeWalletEnabled ? "enabled" : "disabled"}
      data-mobile-wallet-shared-model={mobileWallet ? "true" : "false"}
      data-testid="mobile-home-wallet"
      data-unified-map-surface={unifiedMapSurfaceEnabled ? "enabled" : "disabled"}
    >
      <section
        className="globe-layer native-map-pointer-passthrough native-map-surface-shell absolute inset-x-0 bottom-0 top-0 overflow-hidden bg-black"
        data-testid="mobile-home-launch-globe"
      >
        <AlmidyLaunchGlobe
          className="absolute inset-0 h-full w-full"
          defaultFocusWhenEmpty
          showCountryPin={false}
          useLocationFocus
        />
        <div
          className="native-map-web-interactive absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-30 flex flex-col gap-2"
          data-testid="mobile-home-globe-controls"
        >
          <Link
            aria-label="Open map"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/72 text-white shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:bg-black/82 focus:outline-none focus:ring-4 focus:ring-orange-400/25"
            href={dashboardActionRoutes.globe.openMap}
          >
            <Map className="h-5 w-5" aria-hidden="true" />
          </Link>
          <button
            aria-label="Use current location"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/72 text-white shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:bg-black/82 focus:outline-none focus:ring-4 focus:ring-orange-400/25"
            onClick={requestCurrentLocation}
            type="button"
          >
            <LocateFixed className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </section>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[42dvh] bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(2,6,23,0.14)_34%,rgba(2,6,23,0.78)_100%)]"
      />
      {!latestTrip && unifiedMapSurfaceEnabled ? (
        <LaunchFirstTripCard
          onCreateTripStart={pushCreateTrip}
        />
      ) : null}

      <section
        className="launch-bottom-sheet native-map-web-interactive pointer-events-none absolute inset-x-0 bottom-0 z-30"
        data-testid="mobile-home-wallet-stage"
      >
        <TravelWalletSheet
          featuredTripImage={latestTrip ? heroImage : undefined}
          onCreateTrip={pushCreateTrip}
          primaryHref={primaryHref}
          primaryLabel={primaryLabel}
          primaryMeta={primaryMeta}
          recentTrips={recentTrips}
          forceExpanded={isCreatingFirstTrip}
          initialSheetState={resolvedInitialSheetState}
        />
      </section>
      <MobileHomeWalletLayerStack
        draft={draft}
        layer={walletLayer}
        onCancelCreate={popToMyTrips}
        onDraftChange={setDraft}
        onOpenBackground={() => pushWalletLayer("backgroundPicker")}
        onOpenDates={() => pushWalletLayer("datePicker")}
        onPopToCreate={popToCreateTrip}
      />
    </section>
  );

  if (!mobileGlobeWalletEnabled) {
    return walletSurface;
  }

  return (
    <MobileGlobeWalletShell initialMode="globe" rootLayer="launch" rootRoute="/dashboard">
      {walletSurface}
    </MobileGlobeWalletShell>
  );
}

function LaunchFirstTripCard({
  onCreateTripStart
}: {
  onCreateTripStart: () => void;
}) {
  const { location } = useUnifiedMap();
  const countryFlag = location.source === "browser" ? countryCodeToFlag(location.countryCode) : null;
  const navigationTimeoutRef = useRef<number | null>(null);
  const [isSlidingOut, setIsSlidingOut] = useState(false);

  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        window.clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  function createTrip(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (isSlidingOut) return;

    setIsSlidingOut(true);
    onCreateTripStart();
    navigationTimeoutRef.current = window.setTimeout(() => {
      setIsSlidingOut(false);
    }, 500);
  }

  return (
    <section
      aria-label="Create your first trip"
      className={cn(
        "trip-card-overlay absolute inset-x-4 top-[max(4rem,calc(env(safe-area-inset-top)+1rem))] z-30 transform-gpu transition-[opacity,transform] duration-[400ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
        isSlidingOut
          ? "slide-out-up pointer-events-none -translate-y-[130%] opacity-0"
          : "pointer-events-none translate-y-0 opacity-100"
      )}
      data-testid="launch-first-trip-card"
      id="create-trip-card"
    >
      <div
        className={cn(
          "native-map-web-interactive native-map-web-opaque grid min-h-[6.75rem] grid-cols-[3.25rem_minmax(0,1fr)] gap-3 rounded-[1.4rem] bg-white px-3.5 py-3 text-slate-950 shadow-[0_18px_46px_rgba(0,0,0,0.24)] ring-1 ring-black/5 min-[390px]:min-h-[7.15rem] min-[390px]:grid-cols-[3.5rem_minmax(0,1fr)] min-[390px]:rounded-[1.55rem] min-[390px]:px-4",
          isSlidingOut ? "pointer-events-none" : "pointer-events-auto"
        )}
      >
        <div
          aria-hidden="true"
          className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-[1.95rem] text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] min-[390px]:h-[3.25rem] min-[390px]:w-[3.25rem] min-[390px]:text-[2.1rem]"
          data-has-country-flag={countryFlag ? "true" : "false"}
          data-testid="launch-first-trip-country-flag"
        >
          {countryFlag ?? <MapPin aria-hidden="true" className="h-6 w-6" />}
        </div>
        <div className="min-w-0">
          <h2 className="text-[1.18rem] font-black leading-tight tracking-normal text-slate-950 min-[390px]:text-[1.32rem]">
            Create your first trip
          </h2>
          <p className="mt-1 text-[0.9rem] font-semibold leading-snug text-slate-400 min-[390px]:text-[0.98rem]">
            After creating a trip, a country flag will appear on the map to mark its location.
          </p>
          <Link
            className="mt-2 inline-flex min-h-8 items-center rounded-full text-[0.98rem] font-black text-orange-500 transition hover:text-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-300/20 min-[390px]:text-[1.05rem]"
            data-testid="launch-first-trip-create"
            href="/dashboard"
            id="create-trip-btn"
            onClick={createTrip}
          >
            Create Trip
          </Link>
        </div>
      </div>
    </section>
  );
}

const emptyTripDraft: TripDraft = {
  backgroundColor: null,
  backgroundImageUrl: null,
  destinationMetadata: undefined,
  endDate: null,
  name: "",
  startDate: null
};

function MobileHomeWalletLayerStack({
  draft,
  layer,
  onCancelCreate,
  onDraftChange,
  onOpenBackground,
  onOpenDates,
  onPopToCreate
}: {
  draft: TripDraft;
  layer: WalletLayer;
  onCancelCreate: () => void;
  onDraftChange: (draft: TripDraft) => void;
  onOpenBackground: () => void;
  onOpenDates: () => void;
  onPopToCreate: () => void;
}) {
  if (layer === "myTrips") {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
      data-testid="dashboard-wallet-layer-stack"
      data-wallet-layer={layer}
      data-wallet-stack-interaction="slide"
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-3 bottom-0 rounded-t-[2rem] bg-white/16 shadow-[0_-24px_70px_rgba(0,0,0,0.24)] backdrop-blur-sm transition-transform duration-300",
          layer === "createTrip" ? "top-[30dvh] translate-y-8" : "top-[20dvh] translate-y-4"
        )}
      />
      <WalletLayerFrame
        className="inset-x-0 bottom-0 top-[7.5dvh]"
        handleLabel="Dismiss create trip"
        onDismiss={onCancelCreate}
        testId="wallet-create-layer-frame"
      >
        <TripCreateForm
          draft={draft}
          mode="mobile-pass"
          onCancel={onCancelCreate}
          onDraftChange={onDraftChange}
          onOpenBackgroundPicker={onOpenBackground}
          onOpenDatePicker={onOpenDates}
          redirectOnSuccess
          successRedirectHref="/dashboard/trips"
        />
      </WalletLayerFrame>
      {layer === "datePicker" ? (
        <DatePickerLayer
          draft={draft}
          onCancel={onPopToCreate}
          onConfirm={onPopToCreate}
          onDraftChange={onDraftChange}
        />
      ) : null}
      {layer === "backgroundPicker" ? (
        <BackgroundPickerLayer
          draft={draft}
          onCancel={onPopToCreate}
          onDraftChange={onDraftChange}
          onSelect={onPopToCreate}
        />
      ) : null}
    </div>
  );
}

function WalletLayerFrame({
  children,
  className,
  handleLabel,
  onDismiss,
  testId
}: {
  children: ReactNode;
  className: string;
  handleLabel: string;
  onDismiss: () => void;
  testId: string;
}) {
  const touchStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const frameStyle: CSSProperties | undefined = dragOffset
    ? { transform: `translateY(${dragOffset}px)` }
    : undefined;

  function handleTouchStart(event: TouchEvent<HTMLButtonElement>) {
    touchStartY.current = event.touches[0]?.clientY ?? null;
    setIsDragging(true);
  }

  function handleTouchMove(event: TouchEvent<HTMLButtonElement>) {
    if (touchStartY.current === null) {
      return;
    }

    const nextOffset = Math.max(0, event.touches[0].clientY - touchStartY.current);
    setDragOffset(nextOffset);
  }

  function handleTouchEnd() {
    const shouldDismiss = dragOffset > 72;

    touchStartY.current = null;
    setIsDragging(false);
    setDragOffset(0);

    if (shouldDismiss) {
      onDismiss();
    }
  }

  return (
    <div
      className={cn(
        "wallet-layer-slide-up pointer-events-auto absolute overflow-visible transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]",
        isDragging && "!transition-none",
        className
      )}
      data-dragging={isDragging ? "true" : undefined}
      data-testid={testId}
      style={frameStyle}
    >
      <button
        aria-label={handleLabel}
        className="absolute left-1/2 top-3 z-20 grid h-8 w-28 -translate-x-1/2 touch-none place-items-center rounded-full focus:outline-none focus:ring-4 focus:ring-orange-300/20"
        data-testid={`${testId}-handle`}
        onClick={onDismiss}
        onTouchCancel={handleTouchEnd}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchStart}
        type="button"
      >
        <span aria-hidden="true" className="h-1 w-11 rounded-full bg-white/55 shadow-[0_1px_3px_rgba(0,0,0,0.28)]" />
      </button>
      {children}
    </div>
  );
}

function DatePickerLayer({
  draft,
  onCancel,
  onConfirm,
  onDraftChange
}: {
  draft: TripDraft;
  onCancel: () => void;
  onConfirm: () => void;
  onDraftChange: (draft: TripDraft) => void;
}) {
  const [workingStartDate, setWorkingStartDate] = useState(draft.startDate);
  const [workingEndDate, setWorkingEndDate] = useState(draft.endDate);
  const months = [new Date(2026, 6, 1), new Date(2026, 7, 1)];

  function chooseDate(value: string) {
    if (!workingStartDate || workingEndDate) {
      setWorkingStartDate(value);
      setWorkingEndDate(null);
      return;
    }

    if (value < workingStartDate) {
      setWorkingStartDate(value);
      setWorkingEndDate(workingStartDate);
      return;
    }

    setWorkingEndDate(value);
  }

  function confirmDates() {
    onDraftChange({
      ...draft,
      endDate: workingEndDate,
      startDate: workingStartDate
    });
    onConfirm();
  }

  return (
    <WalletLayerFrame
      className="inset-x-0 bottom-0 z-50 max-h-[72dvh]"
      handleLabel="Dismiss date picker"
      onDismiss={onCancel}
      testId="wallet-date-layer-frame"
    >
      <section
        className="max-h-[72dvh] overflow-y-auto rounded-t-[2rem] bg-white px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-8 text-black shadow-[0_-28px_80px_rgba(0,0,0,0.38)]"
        data-testid="wallet-date-picker-layer"
      >
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <button className="inline-flex min-h-12 items-center rounded-full border border-slate-200 px-5 text-lg font-semibold" onClick={onCancel} type="button">
          Cancel
        </button>
        <h2 className="truncate text-center text-xl font-black">
          {formatDraftDateRange(workingStartDate, workingEndDate)}
        </h2>
        <button className="inline-flex min-h-12 items-center rounded-full bg-orange-500 px-5 text-lg font-black text-white" onClick={confirmDates} type="button">
          Confirm
        </button>
      </header>
      <div className="mt-7 grid gap-9">
        {months.map((month) => (
          <MonthGrid
            endDate={workingEndDate}
            key={month.toISOString()}
            month={month}
            onChooseDate={chooseDate}
            startDate={workingStartDate}
          />
        ))}
      </div>
      </section>
    </WalletLayerFrame>
  );
}

function MonthGrid({
  endDate,
  month,
  onChooseDate,
  startDate
}: {
  endDate: string | null;
  month: Date;
  onChooseDate: (value: string) => void;
  startDate: string | null;
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDayOffset = new Date(year, monthIndex, 1).getDay();
  const cells = [
    ...Array.from({ length: firstDayOffset }, (_, index) => ({ key: `blank-${index}`, value: null })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      return { key: String(day), value: dateValue(year, monthIndex, day) };
    })
  ];

  return (
    <section>
      <h3 className="text-[1.65rem] font-medium tracking-normal">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
      <div className="mt-5 grid grid-cols-7 gap-y-4 text-center">
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
          <span className="text-sm font-medium text-slate-300" key={day}>{day}</span>
        ))}
        {cells.map((cell) => {
          const selected = Boolean(cell.value && (cell.value === startDate || cell.value === endDate));
          const inRange = Boolean(cell.value && startDate && endDate && cell.value > startDate && cell.value < endDate);
          return cell.value ? (
            <button
              key={cell.key}
              aria-pressed={selected}
              className={cn(
                "mx-auto grid h-11 w-11 place-items-center rounded-full text-xl font-medium text-black",
                inRange && "bg-orange-50",
                selected && "bg-orange-500 font-black text-white"
              )}
              data-testid="wallet-date-day"
              onClick={() => onChooseDate(cell.value || "")}
              type="button"
            >
              {Number(cell.key)}
            </button>
          ) : (
            <span aria-hidden="true" key={cell.key} />
          );
        })}
      </div>
    </section>
  );
}

function BackgroundPickerLayer({
  draft,
  onCancel,
  onDraftChange,
  onSelect
}: {
  draft: TripDraft;
  onCancel: () => void;
  onDraftChange: (draft: TripDraft) => void;
  onSelect: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const colors = ["#807867", "#2f4f4f", "#164e63", "#574536", "#f97316", "#e5e7eb"];

  function chooseColor(backgroundColor: string) {
    onDraftChange({
      ...draft,
      backgroundColor,
      backgroundImageUrl: null
    });
    onSelect();
  }

  function chooseUpload(file: File | undefined) {
    if (!file) return;
    const nextUrl = URL.createObjectURL(file);
    onDraftChange({
      ...draft,
      backgroundColor: null,
      backgroundImageUrl: nextUrl
    });
    onSelect();
  }

  return (
    <WalletLayerFrame
      className="inset-x-0 bottom-0 z-50 max-h-[72dvh]"
      handleLabel="Dismiss background picker"
      onDismiss={onCancel}
      testId="wallet-background-layer-frame"
    >
      <section
        className="max-h-[72dvh] overflow-y-auto rounded-t-[2rem] bg-[#1b1b1d] px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-8 text-white shadow-[0_-28px_80px_rgba(0,0,0,0.42)]"
        data-testid="wallet-background-picker-layer"
      >
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <button className="inline-flex min-h-12 items-center rounded-full border border-white/10 px-5 text-lg font-semibold" onClick={onCancel} type="button">
          Cancel
        </button>
        <h2 className="truncate text-center text-xl font-black">Choose Image</h2>
        <button aria-label="Upload background image" className="grid h-12 w-12 place-items-center rounded-full border border-white/12" onClick={() => fileInputRef.current?.click()} type="button">
          <Upload className="h-6 w-6" aria-hidden="true" />
        </button>
      </header>
      <div className="mt-7 grid grid-cols-2 rounded-full bg-white/10 p-1 text-center text-sm font-bold">
        <span className="rounded-full bg-white/30 py-2">Images</span>
        <span className="py-2">Colors</span>
      </div>
      <button
        className="mt-5 grid min-h-24 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-[1.35rem] bg-white/8 px-4 text-left"
        onClick={() => fileInputRef.current?.click()}
        type="button"
      >
        <ImageIcon className="h-8 w-8 text-white/60" aria-hidden="true" />
        <span>
          <span className="block text-lg font-black">User upload</span>
          <span className="mt-1 block text-sm font-semibold text-white/54">Choose an image from this device.</span>
        </span>
        <Check className="h-5 w-5 text-white/36" aria-hidden="true" />
      </button>
      <div className="mt-6 grid grid-cols-3 gap-3" aria-label="Background colors">
        {colors.map((color) => (
          <button
            aria-label={`Use background color ${color}`}
            className="aspect-square rounded-[1.25rem] ring-1 ring-white/12 focus:outline-none focus:ring-4 focus:ring-orange-300/25"
            key={color}
            onClick={() => chooseColor(color)}
            style={{ backgroundColor: color }}
            type="button"
          />
        ))}
      </div>
      <input
        accept="image/*"
        className="sr-only"
        onChange={(event) => chooseUpload(event.target.files?.[0])}
        ref={fileInputRef}
        type="file"
      />
      </section>
    </WalletLayerFrame>
  );
}

function dateValue(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function formatDraftDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) return "No date set";
  if (startDate && !endDate) return formatShortDate(startDate);
  if (!startDate && endDate) return formatShortDate(endDate);
  return `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`;
}

function formatShortDate(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short"
  });
}
