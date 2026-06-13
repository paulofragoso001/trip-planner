"use client";

import {
  CalendarClock,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  MoreHorizontal,
  Navigation,
  Share2,
  Sparkles,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import TripMap, { type TripMapItem } from "@/components/TripMap";

export type ActivityDetailRecommendation = {
  address: string | null;
  bookingUrl: string | null;
  category: string | null;
  id: string;
  imageAlt: string | null;
  imageAttribution: string | null;
  imageUrl: string | null;
  lat: number | null;
  lng: number | null;
  meta?: string | null;
  provider: string;
  ratingLabel: string | null;
  reason: string | null;
  title: string;
  type: string;
};

export type ActivityDetailTarget =
  | { type: "segment"; item: TripMapItem }
  | { type: "recommendation"; item: ActivityDetailRecommendation };

type ActivityDetailSheetProps = {
  disabled?: boolean;
  onClose: () => void;
  onSaveRecommendation?: (item: ActivityDetailRecommendation) => void;
  target: ActivityDetailTarget | null;
  tripId: string;
};

export function ActivityDetailSheet({
  disabled = false,
  onClose,
  onSaveRecommendation,
  target,
  tripId
}: ActivityDetailSheetProps) {
  const [shared, setShared] = useState(false);
  const detail = useMemo(() => (target ? getDetailView(target) : null), [target]);
  const mapItem = useMemo(() => (detail ? getDetailMapItem(detail) : null), [detail]);

  useEffect(() => {
    if (!target) return;

    const { overflow, overscrollBehavior } = document.body.style;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = overflow;
      document.body.style.overscrollBehavior = overscrollBehavior;
    };
  }, [target]);

  async function shareDetail() {
    if (!detail) return;

    const text = `${detail.title}${detail.location ? ` - ${detail.location}` : ""}`;
    const browserNavigator =
      typeof navigator !== "undefined"
        ? (navigator as Navigator & {
            clipboard?: Clipboard;
            share?: (data: ShareData) => Promise<void>;
          })
        : null;

    try {
      if (browserNavigator?.share) {
        await browserNavigator.share({ text, title: detail.title });
      } else if (browserNavigator?.clipboard) {
        await browserNavigator.clipboard.writeText(typeof window === "undefined" ? text : window.location.href);
        setShared(true);
        window.setTimeout(() => setShared(false), 1800);
      }
    } catch {
      setShared(false);
    }
  }

  if (!target || !detail) return null;

  const sheet = (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[2147483647] isolate bg-[#080b10] text-white"
      data-testid="activity-detail-sheet"
      role="dialog"
    >
      <div
        className="relative h-[46svh] min-h-[300px] overflow-hidden bg-[#07182b]"
        data-testid="activity-detail-map"
      >
        {mapItem ? (
          <TripMap
            height="46svh"
            items={[mapItem]}
            mapTheme="dark"
            selectedId={mapItem.id}
            showRouteDetails={false}
            travelMode="WALKING"
          />
        ) : (
          <div className="relative h-full overflow-hidden bg-[radial-gradient(circle_at_50%_42%,rgba(249,115,22,0.3),transparent_20%),linear-gradient(145deg,#102032,#090d14_62%,#1b1209)]">
            <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:40px_40px]" />
            <div className="absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-white/20" />
            <div className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-orange-500 text-white shadow-2xl ring-4 ring-black/35">
              <MapPin className="h-7 w-7" aria-hidden="true" />
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/15 via-transparent to-[#252527]" />
      </div>

      <section className="absolute inset-x-0 bottom-0 max-h-[74svh] overflow-y-auto rounded-t-[2rem] bg-[#252527]/98 px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/10 backdrop-blur-2xl sm:left-1/2 sm:max-w-2xl sm:-translate-x-1/2">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/40" />

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="break-words text-4xl font-black tracking-tight text-white">
              {detail.title}
            </h2>
            <p className="mt-1 max-w-sm text-lg font-semibold leading-tight text-white/48">
              {[detail.categoryLabel, detail.location].filter(Boolean).join(" in ")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              aria-label="Share activity"
              className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white/70"
              onClick={shareDetail}
              type="button"
            >
              <Share2 className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              aria-label="Close activity detail"
              className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white/70"
              onClick={onClose}
              type="button"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {shared ? (
          <p className="mt-3 rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold text-white/70">
            Link copied.
          </p>
        ) : null}

        <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-3">
          {detail.directionsUrl ? (
            <a
              className="grid min-h-[92px] place-items-center rounded-2xl bg-[#1a1a1c] px-2 text-center text-sm font-bold text-white/62 ring-1 ring-white/6"
              href={detail.directionsUrl}
              rel="noreferrer"
              target="_blank"
            >
              <Navigation className="mb-2 h-7 w-7 text-orange-400" aria-hidden="true" />
              Directions
            </a>
          ) : null}
          {detail.websiteUrl ? (
            <a
              className="grid min-h-[92px] place-items-center rounded-2xl bg-[#1a1a1c] px-2 text-center text-sm font-bold text-white/62 ring-1 ring-white/6"
              href={detail.websiteUrl}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink className="mb-2 h-7 w-7 text-orange-400" aria-hidden="true" />
              Website
            </a>
          ) : null}
          <button
            className="grid min-h-[92px] place-items-center rounded-2xl bg-[#1a1a1c] px-2 text-center text-sm font-bold text-white/62 ring-1 ring-white/6"
            type="button"
          >
            <MoreHorizontal className="mb-2 h-7 w-7 text-orange-400" aria-hidden="true" />
            More
          </button>
        </div>

        {target.type === "recommendation" ? (
          <RecommendationDetailBody
            detail={detail}
            disabled={disabled}
            onSave={() => onSaveRecommendation?.(target.item)}
          />
        ) : (
          <SegmentDetailBody detail={detail} item={target.item} onClose={onClose} tripId={tripId} />
        )}
      </section>
    </div>
  );

  return sheet;
}

function SegmentDetailBody({
  detail,
  item,
  onClose,
  tripId
}: {
  detail: DetailView;
  item: TripMapItem;
  onClose: () => void;
  tripId: string;
}) {
  return (
    <div className="mt-5 grid gap-4">
      <div className="rounded-2xl bg-[#1a1a1c] ring-1 ring-white/6">
        <ScheduleSummaryRow
          icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
          label="Starts"
          value={formatSchedule(item.startTime, item.hasStartTime)}
        />
        <ScheduleSummaryRow
          icon={<Clock className="h-5 w-5" aria-hidden="true" />}
          label="Ends"
          value={formatSchedule(item.endTime, item.hasEndTime) || "Date / Time"}
        />
      </div>

      {detail.details.length ? (
        <div className="rounded-2xl bg-[#1a1a1c] px-4 py-3 ring-1 ring-white/6">
          {detail.details.map((entry) => (
            <div className="border-b border-white/8 py-3 last:border-0" key={entry.label}>
              <p className="text-sm font-semibold text-white/42">{entry.label}</p>
              <p className="mt-1 break-words text-base font-semibold text-orange-300">{entry.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {item.notes ? (
        <div className="rounded-2xl bg-[#1a1a1c] px-4 py-3 ring-1 ring-white/6">
          <p className="text-sm font-semibold text-white/42">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-white/68">{item.notes}</p>
        </div>
      ) : null}

      <a
        className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-orange-500 px-5 text-base font-black text-white shadow-xl shadow-orange-950/25"
        href={`/dashboard/trips/${encodeURIComponent(tripId)}/timeline#${encodeURIComponent(item.id)}`}
        onClick={onClose}
      >
        Open in itinerary
      </a>
    </div>
  );
}

function RecommendationDetailBody({
  detail,
  disabled,
  onSave
}: {
  detail: DetailView;
  disabled: boolean;
  onSave: () => void;
}) {
  return (
    <div className="mt-5 grid gap-4">
      <div className="rounded-2xl bg-[#1a1a1c] ring-1 ring-white/6">
        <ScheduleSummaryRow
          icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
          label="Starts"
          value="Save this idea to schedule it"
        />
        <ScheduleSummaryRow
          icon={<Clock className="h-5 w-5" aria-hidden="true" />}
          label="Ends"
          value="After it is on your trip"
        />
      </div>

      {detail.details.length ? (
        <div className="rounded-2xl bg-[#1a1a1c] px-4 py-3 ring-1 ring-white/6">
          {detail.details.map((entry) => (
            <div className="border-b border-white/8 py-3 last:border-0" key={entry.label}>
              <p className="text-sm font-semibold text-white/42">{entry.label}</p>
              <p className="mt-1 break-words text-base font-semibold text-orange-300">{entry.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {detail.notes ? (
        <div className="rounded-2xl bg-[#1a1a1c] px-4 py-3 ring-1 ring-white/6">
          <p className="text-sm font-semibold text-white/42">Notes</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-white/68">{detail.notes}</p>
        </div>
      ) : null}

      <button
        className="min-h-14 rounded-2xl bg-orange-500 px-5 text-base font-black text-white shadow-xl shadow-orange-950/25 disabled:opacity-60"
        disabled={disabled}
        onClick={onSave}
        type="button"
      >
        {disabled ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Saving...
          </span>
        ) : (
          "Save to trip"
        )}
      </button>
    </div>
  );
}

function ScheduleSummaryRow({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[36px_1fr_auto] items-center gap-3 border-b border-white/8 px-4 py-4 last:border-0">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/52">{icon}</span>
      <span className="text-base font-black text-white/46">{label}</span>
      <span className="max-w-[12rem] truncate rounded-xl bg-white/8 px-3 py-2 text-right text-base font-semibold text-white">
        {value}
      </span>
    </div>
  );
}

type DetailView = {
  address: string | null;
  category: string | null;
  categoryLabel: string | null;
  details: { label: string; value: string }[];
  directionsUrl: string | null;
  id: string;
  imageAlt: string | null;
  imageAttribution: string | null;
  imageUrl: string | null;
  lat: number | null;
  lng: number | null;
  location: string | null;
  notes: string | null;
  title: string;
  websiteUrl: string | null;
};

function getDetailView(target: ActivityDetailTarget): DetailView {
  if (target.type === "segment") {
    const { item } = target;
    const details = [
      item.provider ? { label: "Source", value: item.provider.replace(/_/g, " ") } : null,
      item.confirmationCode ? { label: "Confirmation", value: item.confirmationCode } : null
    ].filter(Boolean) as { label: string; value: string }[];

    return {
      address: item.address || null,
      category: item.category || item.kind || null,
      categoryLabel: labelize(item.category || item.kind),
      details,
      directionsUrl: buildDirectionsUrl(item.lat, item.lng, item.address || item.title),
      id: item.id,
      imageAlt: item.imageAlt || null,
      imageAttribution: item.imageAttribution || null,
      imageUrl: item.imageUrl || null,
      lat: item.lat,
      lng: item.lng,
      location: item.address || null,
      notes: item.notes || null,
      title: item.title,
      websiteUrl: item.bookingUrl || null
    };
  }

  const { item } = target;
  const details = [
    item.provider ? { label: "Source", value: item.provider.replace(/_/g, " ") } : null,
    item.ratingLabel ? { label: "Rating", value: `${item.ratingLabel} stars` } : null
  ].filter(Boolean) as { label: string; value: string }[];

  return {
    address: item.address || null,
    category: item.category || item.type || null,
    categoryLabel: labelize(item.category || item.type),
    details,
    directionsUrl: buildDirectionsUrl(item.lat, item.lng, item.address || item.title),
    id: item.id,
    imageAlt: item.imageAlt || null,
    imageAttribution: item.imageAttribution || null,
    imageUrl: item.imageUrl || null,
    lat: item.lat,
    lng: item.lng,
    location: item.address || null,
    notes: item.reason || null,
    title: item.title,
    websiteUrl: item.bookingUrl || null
  };
}

function getDetailMapItem(detail: DetailView): TripMapItem | null {
  if (typeof detail.lat !== "number" || typeof detail.lng !== "number") return null;

  return {
    address: detail.address,
    category: detail.category,
    id: detail.id,
    imageAlt: detail.imageAlt,
    imageAttribution: detail.imageAttribution,
    imageUrl: detail.imageUrl,
    lat: detail.lat,
    lng: detail.lng,
    routeOrder: 1,
    status: "resolved",
    title: detail.title
  };
}

function buildDirectionsUrl(lat: number | null, lng: number | null, fallback: string | null) {
  if (typeof lat === "number" && typeof lng === "number") {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  if (fallback) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallback)}`;
  }
  return null;
}

function formatSchedule(value: string | null | undefined, hasTime?: boolean) {
  if (!value) return "Date / Time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date / Time";

  if (hasTime === false) {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    }).format(date);
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC"
  }).format(date);
}

function labelize(value: string | null | undefined) {
  if (!value) return null;
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
