"use client";

import { Check, ImageIcon, MapPin, Upload } from "lucide-react";
import Link from "next/link";
import type { MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { DashboardData } from "@/app/dashboard/loader";
import { AlmidyLaunchGlobe } from "@/components/dashboard/almidy-launch-globe";
import { TravelWalletSheet } from "@/components/dashboard/travel-wallet-sheet";
import { TripCreateForm, type TripDraft, type WalletLayer } from "@/components/dashboard/trip-create-form";
import { cn } from "@/components/trip-ui";
import { unifiedMapSurfaceEnabled } from "@/lib/map/feature-flags";
import { UnifiedMapProvider, useUnifiedMap } from "@/lib/map/unified-map-provider";
import { countryCodeToFlag } from "@/lib/map/wayline-map-pins";

type MobileHomeWalletProps = Pick<DashboardData, "metrics" | "recentTrips"> & {
  className?: string;
  initialSheetState?: "collapsed" | "expanded";
};

export function MobileHomeWallet({
  className,
  initialSheetState = "collapsed",
  metrics,
  recentTrips
}: MobileHomeWalletProps) {
  const latestTrip = recentTrips[0] || null;
  const resolvedInitialSheetState = initialSheetState;
  const [isCreatingFirstTrip, setIsCreatingFirstTrip] = useState(false);
  const importsWaiting =
    metrics.find((metric) => metric.label === "Ideas waiting")?.value ??
    metrics.find((metric) => metric.label === "Imports waiting")?.value ??
    "0";
  const ideasWaitingCount = Number.parseInt(importsWaiting.replace(/[^\d]/g, ""), 10) || 0;
  const primaryHref = latestTrip ? latestTrip.href : "/dashboard/trips?view=list#new-trip";
  const primaryLabel = latestTrip ? "Continue trip" : "Create trip";
  const primaryMeta = latestTrip
    ? `${latestTrip.name} · ${latestTrip.destination}`
    : "Start a new travel wallet.";
  const [walletLayer, setWalletLayer] = useState<WalletLayer>("myTrips");
  const [draft, setDraft] = useState<TripDraft>(emptyTripDraft);

  function pushCreateTrip() {
    setIsCreatingFirstTrip(true);
    setWalletLayer("createTrip");
  }

  function popToMyTrips() {
    setWalletLayer("myTrips");
    setIsCreatingFirstTrip(false);
  }

  function popToCreateTrip() {
    setWalletLayer("createTrip");
  }

  const walletSurface = (
    <section
      className={cn(
        "mobile-launch-globe relative isolate h-[100dvh] overflow-hidden bg-black text-white lg:hidden",
        className
      )}
      data-testid="mobile-home-wallet"
      data-unified-map-surface={unifiedMapSurfaceEnabled ? "enabled" : "disabled"}
    >
      <section
        className="globe-layer absolute inset-x-0 bottom-0 top-0 overflow-hidden bg-black"
        data-testid="mobile-home-launch-globe"
      >
        <AlmidyLaunchGlobe
          className="absolute inset-0 h-full w-full"
          defaultFocusWhenEmpty
          showCountryPin={false}
          useLocationFocus
        />
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
        className="launch-bottom-sheet pointer-events-none absolute inset-x-0 bottom-0 z-30"
        data-testid="mobile-home-wallet-stage"
      >
        <TravelWalletSheet
          ideasWaitingCount={ideasWaitingCount}
          onCreateTrip={!latestTrip ? pushCreateTrip : undefined}
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
        onOpenBackground={() => setWalletLayer("backgroundPicker")}
        onOpenDates={() => setWalletLayer("datePicker")}
        onPopToCreate={popToCreateTrip}
      />
    </section>
  );

  if (!unifiedMapSurfaceEnabled) {
    return walletSurface;
  }

  return <UnifiedMapProvider initialMode="globe">{walletSurface}</UnifiedMapProvider>;
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
          "grid min-h-[6.75rem] grid-cols-[3.25rem_minmax(0,1fr)] gap-3 rounded-[1.4rem] bg-white px-3.5 py-3 text-slate-950 shadow-[0_18px_46px_rgba(0,0,0,0.24)] ring-1 ring-black/5 min-[390px]:min-h-[7.15rem] min-[390px]:grid-cols-[3.5rem_minmax(0,1fr)] min-[390px]:rounded-[1.55rem] min-[390px]:px-4",
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
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-3 bottom-0 top-[28dvh] rounded-t-[2rem] bg-white/16 shadow-[0_-24px_70px_rgba(0,0,0,0.24)] backdrop-blur-sm transition-transform duration-300",
          layer === "createTrip" ? "translate-y-8" : "translate-y-4"
        )}
      />
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 top-[7.5dvh] overflow-visible">
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
      </div>
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
    <section
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-50 max-h-[72dvh] overflow-y-auto rounded-t-[2rem] bg-white px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-5 text-black shadow-[0_-28px_80px_rgba(0,0,0,0.38)]"
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
    <section
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-50 max-h-[72dvh] overflow-y-auto rounded-t-[2rem] bg-[#1b1b1d] px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-5 text-white shadow-[0_-28px_80px_rgba(0,0,0,0.42)]"
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
