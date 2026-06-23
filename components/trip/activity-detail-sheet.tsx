"use client";

import {
  CalendarClock,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  MoreHorizontal,
  Navigation,
  Plane,
  Share2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GoogleMapRenderer } from "@/components/map/google-map-renderer";
import type { TripMapItem } from "@/components/TripMap";
import { DisplayAddressSheet } from "@/components/trip/display-address-sheet";
import type { WaylineMapSurfaceState } from "@/lib/map/wayline-map-models";
import {
  hasResolvedRoute,
  routeEndpointLabel,
  routeTitleLabel,
  type TripRouteEndpoint,
  type TripSegmentRouteMetadata
} from "@/lib/trip-segment-route";

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

type DetailKind = "lodging" | "route" | "place" | "recommendation";

type DetailRow = {
  accent?: boolean;
  label: string;
  value: string;
};

type ScheduleParts = {
  date: string;
  time: string;
};

type DetailView = {
  address: string | null;
  bookingUrl: string | null;
  category: string | null;
  categoryLabel: string | null;
  confirmation: string | null;
  details: DetailRow[];
  directionsUrl: string | null;
  id: string;
  imageAlt: string | null;
  imageAttribution: string | null;
  imageUrl: string | null;
  kind: DetailKind;
  lat: number | null;
  lng: number | null;
  location: string | null;
  notes: string | null;
  providerMetadata: Record<string, unknown> | null;
  route: TripMapItem["route"];
  subtitle: string | null;
  title: string;
  websiteUrl: string | null;
};

export function ActivityDetailSheet({
  disabled = false,
  onClose,
  onSaveRecommendation,
  target,
  tripId
}: ActivityDetailSheetProps) {
  const [shared, setShared] = useState(false);
  const [displayAddressOpen, setDisplayAddressOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const detail = useMemo(() => (target ? getDetailView(target) : null), [target]);
  const mapItem = useMemo(() => (detail ? getDetailMapItem(detail) : null), [detail]);
  const mapSurface = useMemo(() => (mapItem ? tripItemToMapSurface(mapItem) : null), [mapItem]);
  const displayAddress = useMemo(() => (detail ? getDisplayAddress(detail) : null), [detail]);

  useEffect(() => {
    setDisplayAddressOpen(false);
    setMoreOpen(false);
    setShared(false);
  }, [target?.item.id]);

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

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[2147483647] isolate overflow-hidden bg-[#080b10] text-white"
      data-testid="activity-detail-sheet"
      role="dialog"
    >
      <div
        className="relative h-[42svh] min-h-[280px] overflow-hidden bg-[#07182b]"
        data-testid="activity-detail-map"
      >
        {mapSurface ? (
          <GoogleMapRenderer
            height="42svh"
            mapTheme="dark"
            surfaceState={mapSurface}
          />
        ) : detail.imageUrl ? (
          <img
            alt={detail.imageAlt || ""}
            className="h-full w-full object-cover"
            src={detail.imageUrl}
          />
        ) : (
          <DarkFallbackHeader />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/10 via-transparent to-[#252527]" />
      </div>

      <section
        className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto overscroll-contain rounded-t-[2rem] bg-[#252527]/98 px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/10 backdrop-blur-2xl sm:left-1/2 sm:max-w-2xl sm:-translate-x-1/2 sm:pb-[calc(2rem+env(safe-area-inset-bottom))] lg:max-h-[82vh] lg:pb-6"
        data-testid="activity-detail-panel"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/40" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-[2.35rem] font-black leading-[0.98] tracking-tight text-white sm:text-4xl">
              {detail.title}
            </h2>
            {detail.subtitle ? (
              <p className="mt-2 max-w-sm text-base font-semibold leading-tight text-white/52">
                {detail.subtitle}
              </p>
            ) : null}
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

        <div className="relative mt-6 grid grid-cols-[repeat(auto-fit,minmax(92px,1fr))] gap-3">
          {detail.directionsUrl ? (
            <ActionLink href={detail.directionsUrl} icon={<Navigation />} label="Directions" />
          ) : null}
          {detail.bookingUrl ? (
            <ActionLink href={detail.bookingUrl} icon={<ExternalLink />} label="Reservation" />
          ) : detail.websiteUrl ? (
            <ActionLink href={detail.websiteUrl} icon={<ExternalLink />} label="Website" />
          ) : null}
          <button
            aria-expanded={moreOpen}
            className="grid min-h-[86px] place-items-center rounded-2xl bg-[#1a1a1c] px-2 text-center text-sm font-bold text-white/62 ring-1 ring-white/6"
            onClick={() => setMoreOpen((current) => !current)}
            type="button"
          >
            <MoreHorizontal className="mb-2 h-7 w-7 text-orange-400" aria-hidden="true" />
            More
          </button>
          {moreOpen ? (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-10 w-56 overflow-hidden rounded-2xl bg-[#151517] shadow-2xl ring-1 ring-white/10">
              {target.type === "segment" ? (
                <a
                  className="block px-4 py-3 text-sm font-bold text-white/78 hover:bg-white/8"
                  href={`/dashboard/trips/${encodeURIComponent(tripId)}/timeline#${encodeURIComponent(target.item.id)}`}
                  onClick={onClose}
                >
                  Edit in itinerary
                </a>
              ) : onSaveRecommendation ? (
                <button
                  className="block w-full px-4 py-3 text-left text-sm font-bold text-white/78 hover:bg-white/8 disabled:opacity-60"
                  disabled={disabled}
                  onClick={() => onSaveRecommendation(target.item)}
                  type="button"
                >
                  Save to trip
                </button>
              ) : null}
              {displayAddress ? (
                <button
                  className="block w-full px-4 py-3 text-left text-sm font-bold text-white/78 hover:bg-white/8"
                  onClick={() => {
                    setMoreOpen(false);
                    setDisplayAddressOpen(true);
                  }}
                  type="button"
                >
                  Display address
                </button>
              ) : null}
              <button
                className="block w-full px-4 py-3 text-left text-sm font-bold text-white/58 hover:bg-white/8"
                onClick={shareDetail}
                type="button"
              >
                Share
              </button>
            </div>
          ) : null}
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

      {displayAddressOpen && displayAddress ? (
        <DisplayAddressSheet
          address={displayAddress}
          mapItem={mapItem}
          onClose={() => setDisplayAddressOpen(false)}
          title={detail.title}
        />
      ) : null}
    </div>
  );
}

function tripItemToMapSurface(item: TripMapItem): WaylineMapSurfaceState {
  const coordinate = { lat: item.lat, lng: item.lng };

  return {
    camera: {
      center: coordinate,
      intent: "place",
      selectedId: item.id,
      zoom: 14
    },
    location: {
      coordinate: null,
      permission: "unknown",
      source: "fallback"
    },
    mode: "map",
    pins: [
      {
        address: item.address,
        coordinate,
        id: item.id,
        imageAlt: item.imageAlt,
        imageAttribution: item.imageAttribution,
        imageUrl: item.imageUrl,
        kind: item.kind === "transport" ? "transport" : "place",
        label: item.title,
        order: item.routeOrder,
        provider: item.provider,
        providerPlaceId: item.providerPlaceId,
        selected: true,
        subtitle: item.category,
        tone: "orange"
      }
    ],
    renderer: "google-2d",
    routes: [],
    selectedId: item.id
  };
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
  if (detail.kind === "route") {
    return <RouteDetailBody detail={detail} item={item} onClose={onClose} tripId={tripId} />;
  }

  const scheduleRows = getScheduleRows(detail.kind, item);

  return (
    <div className="mt-5 grid gap-4">
      {scheduleRows.length ? (
        <DetailGroup>
          {scheduleRows.map((row) => (
            <ScheduleSummaryRow key={row.label} {...row} />
          ))}
        </DetailGroup>
      ) : null}

      {detail.details.length ? (
        <DetailRows rows={detail.details} />
      ) : null}

      {detail.notes ? (
        <NotesBlock notes={detail.notes} />
      ) : null}

      <OpenItineraryLink itemId={item.id} onClose={onClose} tripId={tripId} />
    </div>
  );
}

function RouteDetailBody({
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
  const route = detail.route;
  const origin = route?.origin || null;
  const destination = route?.destination || null;
  const depart = formatScheduleParts(route?.departAt || item.startTime, item.hasStartTime);
  const arrive = formatScheduleParts(route?.arriveAt || item.endTime, item.hasEndTime);

  return (
    <div className="mt-5 grid gap-4">
      {origin || destination ? (
        <div className="rounded-2xl bg-[#1a1a1c] px-4 py-2 ring-1 ring-white/6">
          {origin ? <RouteEndpointRow endpoint={origin} label="From" schedule={depart} /> : null}
          {destination ? <RouteEndpointRow endpoint={destination} label="To" schedule={arrive} /> : null}
        </div>
      ) : null}

      {detail.details.length ? (
        <DetailRows rows={detail.details} />
      ) : null}

      {detail.notes ? (
        <NotesBlock notes={detail.notes} />
      ) : null}

      <OpenItineraryLink itemId={item.id} onClose={onClose} tripId={tripId} />
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
      {detail.details.length ? (
        <DetailRows rows={detail.details} />
      ) : null}

      {detail.notes ? (
        <NotesBlock notes={detail.notes} />
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

function ActionLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <a
      className="grid min-h-[86px] place-items-center rounded-2xl bg-[#1a1a1c] px-2 text-center text-sm font-bold text-white/62 ring-1 ring-white/6"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <span className="[&>svg]:mb-2 [&>svg]:h-7 [&>svg]:w-7 [&>svg]:text-orange-400" aria-hidden="true">
        {icon}
      </span>
      {label}
    </a>
  );
}

function DetailGroup({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-[#1a1a1c] ring-1 ring-white/6">{children}</div>;
}

function DetailRows({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="rounded-2xl bg-[#1a1a1c] px-4 py-3 ring-1 ring-white/6">
      {rows.map((entry) => (
        <div className="border-b border-white/8 py-3 last:border-0" key={entry.label}>
          <p className="text-sm font-semibold text-white/42">{entry.label}</p>
          <p className={`mt-1 break-words text-base font-semibold ${entry.accent ? "text-orange-300" : "text-white/78"}`}>
            {entry.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function NotesBlock({ notes }: { notes: string }) {
  return (
    <div className="rounded-2xl bg-[#1a1a1c] px-4 py-3 ring-1 ring-white/6">
      <p className="text-sm font-semibold text-white/42">Notes</p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-white/68">{notes}</p>
    </div>
  );
}

function OpenItineraryLink({
  itemId,
  onClose,
  tripId
}: {
  itemId: string;
  onClose: () => void;
  tripId: string;
}) {
  return (
    <a
      className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-orange-500 px-5 text-base font-black text-white shadow-xl shadow-orange-950/25"
      href={`/dashboard/trips/${encodeURIComponent(tripId)}/timeline#${encodeURIComponent(itemId)}`}
      onClick={onClose}
    >
      Open in itinerary
    </a>
  );
}

function ScheduleSummaryRow({
  icon,
  label,
  schedule,
  value
}: {
  icon: ReactNode;
  label: string;
  schedule?: ScheduleParts | null;
  value?: string | null;
}) {
  if (!schedule && !value) return null;

  return (
    <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/8 px-4 py-4 last:border-0">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/52">{icon}</span>
      <span className="min-w-0 truncate text-base font-black text-white/58">{label}</span>
      {schedule ? (
        <span className="flex min-w-0 max-w-[13rem] items-center gap-2 text-right">
          <span className="truncate rounded-xl bg-white/8 px-3 py-2 text-sm font-semibold text-white">
            {schedule.date}
          </span>
          <span className="truncate rounded-xl bg-white/8 px-3 py-2 text-sm font-semibold text-white">
            {schedule.time}
          </span>
        </span>
      ) : (
        <span className="max-w-[13rem] truncate rounded-xl bg-white/8 px-3 py-2 text-right text-sm font-semibold text-white">
          {value}
        </span>
      )}
    </div>
  );
}

function RouteEndpointRow({
  endpoint,
  label,
  schedule
}: {
  endpoint: TripRouteEndpoint;
  label: string;
  schedule: ScheduleParts | null;
}) {
  const endpointLabel = routeEndpointLabel(endpoint);
  const code = endpoint.code && endpoint.code !== endpointLabel ? endpoint.code : null;

  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] gap-3 border-b border-white/8 py-4 last:border-0">
      <span className="mt-1 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/56">
        <Plane className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-white/36">{label}</p>
        <p className="mt-1 truncate text-lg font-black text-white">{code || endpointLabel || "Route point"}</p>
        {code && endpointLabel ? (
          <p className="truncate text-sm font-semibold text-white/46">{endpointLabel}</p>
        ) : endpoint.address ? (
          <p className="truncate text-sm font-semibold text-white/46">{endpoint.address}</p>
        ) : null}
      </div>
      {schedule ? (
        <div className="text-right">
          <p className="text-lg font-black text-orange-300">{schedule.time}</p>
          <p className="text-sm font-semibold text-white/48">{schedule.date}</p>
        </div>
      ) : null}
    </div>
  );
}

function DarkFallbackHeader() {
  return (
    <div className="relative h-full overflow-hidden bg-[radial-gradient(circle_at_50%_42%,rgba(249,115,22,0.3),transparent_20%),linear-gradient(145deg,#102032,#090d14_62%,#1b1209)]">
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:40px_40px]" />
      <div className="absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-white/20" />
      <div className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-orange-500 text-white shadow-2xl ring-4 ring-black/35">
        <MapPin className="h-7 w-7" aria-hidden="true" />
      </div>
    </div>
  );
}

function getDetailView(target: ActivityDetailTarget): DetailView {
  if (target.type === "segment") {
    const { item } = target;
    const providerMetadata = item.providerMetadata || null;
    const kind = getSegmentDetailKind(item);
    const route = item.route || null;
    const confirmation = cleanString(item.confirmationCode) || cleanString(route?.confirmation);
    const websiteUrl = readProviderUrl(providerMetadata, ["website", "websiteUrl", "websiteUri", "homepage"]);
    const providerAddress = readProviderString(providerMetadata, [
      "address",
      "formattedAddress",
      "formatted_address",
      "placeAddress",
      "location",
      "vicinity"
    ]);
    const title =
      kind === "route"
        ? routeTitleLabel(route, item.title)
        : item.title;
    const categoryLabel = labelize(item.category || item.kind);
    const subtitle = getSegmentSubtitle(item, kind, categoryLabel);
    const details = getSegmentDetails(item, kind, providerMetadata, confirmation, websiteUrl);

    return {
      address: item.address || providerAddress || null,
      bookingUrl: item.bookingUrl || null,
      category: item.category || item.kind || null,
      categoryLabel,
      confirmation,
      details,
      directionsUrl: buildDirectionsUrl(item),
      id: item.id,
      imageAlt: item.imageAlt || null,
      imageAttribution: item.imageAttribution || null,
      imageUrl: item.imageUrl || null,
      kind,
      lat: getFiniteNumber(item.lat),
      lng: getFiniteNumber(item.lng),
      location:
        item.address ||
        providerAddress ||
        routeEndpointLabel(route?.destination) ||
        routeEndpointLabel(route?.origin) ||
        null,
      notes: item.notes || null,
      providerMetadata,
      route,
      subtitle,
      title,
      websiteUrl
    };
  }

  const { item } = target;
  const details = [
    item.provider ? { label: "Source", value: item.provider.replace(/_/g, " "), accent: true } : null,
    item.ratingLabel ? { label: "Rating", value: `${item.ratingLabel} stars` } : null,
    item.address ? { label: "Address", value: item.address } : null
  ].filter(Boolean) as DetailRow[];

  return {
    address: item.address || null,
    bookingUrl: item.bookingUrl || null,
    category: item.category || item.type || null,
    categoryLabel: labelize(item.category || item.type),
    confirmation: null,
    details,
    directionsUrl: buildPointDirectionsUrl(item.lat, item.lng, item.address || null),
    id: item.id,
    imageAlt: item.imageAlt || null,
    imageAttribution: item.imageAttribution || null,
    imageUrl: item.imageUrl || null,
    kind: "recommendation",
    lat: item.lat,
    lng: item.lng,
    location: item.address || null,
    notes: item.reason || null,
    providerMetadata: null,
    route: null,
    subtitle: [labelize(item.category || item.type), item.address].filter(Boolean).join(" in ") || null,
    title: item.title,
    websiteUrl: null
  };
}

function getDisplayAddress(detail: DetailView) {
  return (
    cleanString(detail.address) ||
    cleanString(detail.location) ||
    cleanString(detail.route?.destination?.address) ||
    cleanString(routeEndpointLabel(detail.route?.destination)) ||
    cleanString(detail.route?.origin?.address) ||
    cleanString(routeEndpointLabel(detail.route?.origin))
  );
}

function getSegmentDetailKind(item: TripMapItem): DetailKind {
  const kind = String(item.kind || item.category || "").toLowerCase();
  if (item.route || ["flight", "drive", "train", "bus", "transfer", "ferry", "transport", "transportation"].includes(kind)) {
    return "route";
  }
  if (["hotel", "lodging", "stay", "accommodation"].includes(kind)) {
    return "lodging";
  }
  return "place";
}

function getSegmentSubtitle(item: TripMapItem, kind: DetailKind, categoryLabel: string | null) {
  if (kind === "route") {
    return [item.route?.carrier, item.route?.flightNumber].filter(Boolean).join(" ") || categoryLabel || "Route";
  }
  if (kind === "lodging") {
    return ["Lodging", item.address].filter(Boolean).join(" in ");
  }
  return [categoryLabel, item.address].filter(Boolean).join(" in ") || item.address || categoryLabel;
}

function isFlightRoute(item: TripMapItem) {
  return item.route?.mode === "flight" || String(item.kind || item.category || "").toLowerCase() === "flight";
}

function isFlightDetail(detail: DetailView) {
  return detail.route?.mode === "flight" || String(detail.category || "").toLowerCase() === "flight";
}

function getSegmentDetails(
  item: TripMapItem,
  kind: DetailKind,
  providerMetadata: Record<string, unknown> | null,
  confirmation: string | null,
  websiteUrl: string | null
): DetailRow[] {
  const rows: (DetailRow | null)[] = [];

  if (kind === "route") {
    const flightRoute = isFlightRoute(item);
    const duration = getDurationLabel(item.route?.departAt || item.startTime, item.route?.arriveAt || item.endTime);
    const timezoneDifference = readProviderString(providerMetadata, [
      "timezoneDifference",
      "timezone_difference",
      "timezoneDiff",
      "timeZoneDifference",
      "time_zone_difference"
    ]);
    const distance = getRouteDistance(providerMetadata, item.route);
    rows.push(
      duration ? { label: flightRoute ? "Flight Duration" : "Duration", value: duration } : null,
      timezoneDifference ? { label: "Timezone Difference", value: timezoneDifference } : null,
      distance ? { label: "Distance", value: distance } : null,
      item.route?.carrier ? { label: "Company", value: item.route.carrier } : null,
      item.route?.flightNumber ? { label: "Flight", value: item.route.flightNumber } : null,
      confirmation ? { label: "Confirmation", value: confirmation, accent: true } : null,
      readProviderString(providerMetadata, ["aircraft", "aircraftType"]) ? { label: "Aircraft", value: readProviderString(providerMetadata, ["aircraft", "aircraftType"]) || "" } : null,
      readProviderString(providerMetadata, ["baggageClaim", "baggage"]) ? { label: "Baggage Claim", value: readProviderString(providerMetadata, ["baggageClaim", "baggage"]) || "" } : null
    );
  } else if (kind === "lodging") {
    rows.push(
      getNightsLabel(item.startTime, item.endTime) ? { label: "Nights", value: getNightsLabel(item.startTime, item.endTime) || "" } : null,
      readProviderString(providerMetadata, ["roomType", "room_type"]) ? { label: "Room Type", value: readProviderString(providerMetadata, ["roomType", "room_type"]) || "" } : null,
      readProviderString(providerMetadata, ["roomNumber", "room_number"]) ? { label: "Room Number", value: readProviderString(providerMetadata, ["roomNumber", "room_number"]) || "" } : null,
      confirmation ? { label: "Confirmation", value: confirmation, accent: true } : null
    );
  } else {
    rows.push(
      item.address ? { label: "Address", value: item.address } : null,
      confirmation ? { label: "Confirmation", value: confirmation, accent: true } : null
    );
  }

  rows.push(
    readProviderString(providerMetadata, ["phone", "phoneNumber", "formatted_phone_number", "international_phone_number"])
      ? {
          label: "Phone",
          value: readProviderString(providerMetadata, ["phone", "phoneNumber", "formatted_phone_number", "international_phone_number"]) || ""
        }
      : null,
    websiteUrl ? { label: "Website", value: displayUrl(websiteUrl), accent: true } : null,
    item.provider ? { label: "Source", value: item.provider.replace(/_/g, " "), accent: true } : null
  );

  return rows.filter(Boolean) as DetailRow[];
}

function getScheduleRows(kind: DetailKind, item: TripMapItem) {
  const start = formatScheduleParts(item.startTime, item.hasStartTime);
  const end = formatScheduleParts(item.endTime, item.hasEndTime);

  if (kind === "lodging") {
    return [
      start ? { icon: <CalendarClock className="h-5 w-5" aria-hidden="true" />, label: "Check-in", schedule: start } : null,
      end ? { icon: <Clock className="h-5 w-5" aria-hidden="true" />, label: "Check-out", schedule: end } : null
    ].filter(Boolean) as { icon: ReactNode; label: string; schedule: ScheduleParts }[];
  }

  return [
    start ? { icon: <CalendarClock className="h-5 w-5" aria-hidden="true" />, label: "Starts", schedule: start } : null,
    end ? { icon: <Clock className="h-5 w-5" aria-hidden="true" />, label: "Ends", schedule: end } : null
  ].filter(Boolean) as { icon: ReactNode; label: string; schedule: ScheduleParts }[];
}

function getDetailMapItem(detail: DetailView): TripMapItem | null {
  const route = detail.route;
  if (route && hasResolvedRoute(route)) {
    if (isFlightDetail(detail)) return null;

    const destination = route.destination;
    const lat = getFiniteNumber(destination?.lat) ?? getFiniteNumber(route.origin?.lat);
    const lng = getFiniteNumber(destination?.lng) ?? getFiniteNumber(route.origin?.lng);
    if (typeof lat !== "number" || typeof lng !== "number") return null;

    return {
      address: detail.address,
      category: detail.category,
      id: detail.id,
      imageAlt: detail.imageAlt,
      imageAttribution: detail.imageAttribution,
      imageUrl: detail.imageUrl,
      lat,
      lng,
      route,
      routeOrder: 1,
      status: "resolved",
      title: detail.title
    };
  }

  if (isFlightDetail(detail)) return null;

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

function buildDirectionsUrl(item: TripMapItem) {
  if (hasResolvedRoute(item.route)) {
    if (isFlightRoute(item)) return null;

    const origin = routeEndpointLabel(item.route?.origin);
    const destination = routeEndpointLabel(item.route?.destination);
    if (origin && destination) {
      return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    }
  }

  if (isFlightRoute(item)) return null;

  return buildPointDirectionsUrl(getFiniteNumber(item.lat), getFiniteNumber(item.lng), item.address || null);
}

function buildPointDirectionsUrl(lat: number | null, lng: number | null, fallback: string | null) {
  if (typeof lat === "number" && typeof lng === "number") {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  if (fallback) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallback)}`;
  }
  return null;
}

function formatScheduleParts(value: string | null | undefined, hasTime?: boolean): ScheduleParts | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const dateLabel = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    weekday: "short"
  }).format(date);

  if (hasTime === false) {
    return { date: dateLabel, time: "Anytime" };
  }

  return {
    date: dateLabel,
    time: new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC"
    }).format(date)
  };
}

function getDurationLabel(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const minutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder}m`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function getNightsLabel(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const nights = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
  return nights > 0 ? String(nights) : null;
}

function getRouteDistance(
  metadata: Record<string, unknown> | null,
  route?: TripSegmentRouteMetadata | null
) {
  const value = readProviderString(metadata, ["distance", "distanceLabel", "distanceText"]);
  if (value) return value;
  const miles = readProviderNumber(metadata, ["distanceMiles", "distance_miles", "miles"]);
  if (typeof miles === "number") return `${Math.round(miles).toLocaleString("en")} mi`;
  const routeMiles = getRouteDistanceMiles(route);
  if (routeMiles) return `${Math.round(routeMiles).toLocaleString("en")} mi`;
  return null;
}

function getRouteDistanceMiles(route?: TripSegmentRouteMetadata | null) {
  const originLat = getFiniteNumber(route?.origin?.lat);
  const originLng = getFiniteNumber(route?.origin?.lng);
  const destinationLat = getFiniteNumber(route?.destination?.lat);
  const destinationLng = getFiniteNumber(route?.destination?.lng);
  if (
    originLat == null ||
    originLng == null ||
    destinationLat == null ||
    destinationLng == null
  ) {
    return null;
  }

  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(destinationLat - originLat);
  const dLng = toRadians(destinationLng - originLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(originLat)) *
      Math.cos(toRadians(destinationLat)) *
      Math.sin(dLng / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function readProviderString(metadata: Record<string, unknown> | null, keys: string[]) {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function readProviderNumber(metadata: Record<string, unknown> | null, keys: string[]) {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function readProviderUrl(metadata: Record<string, unknown> | null, keys: string[]) {
  const value = readProviderString(metadata, keys);
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(value)) return `https://${value}`;
  return null;
}

function displayUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function getFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function labelize(value: string | null | undefined) {
  if (!value) return null;
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
