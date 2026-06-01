import "server-only";

import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import {
  listImportSources,
  type ImportSourcesClient
} from "@/lib/server/import-sources";
import {
  listUnfiledItems,
  type UnfiledItemsClient
} from "@/lib/server/unfiled-items";
import { listSocialImportWorkspace } from "@/lib/server/social-imports";
import { resolvePlace as resolveTravelPlace } from "@/lib/travel-data";
import { buildPlacePhotoUrl, readProviderPhoto } from "@/lib/travel-data/photo-url";
import {
  TRIP_TRAVEL_STYLE_LABELS,
  normalizeTravelStyle,
  type TripTravelStyle
} from "@/lib/trips";

export type ImportedContentStatus =
  | "approved"
  | "failed"
  | "pending"
  | "reviewed"
  | "scanning";

export type ImportedContentView = {
  createdAt: string;
  errorMessage: string | null;
  id: string;
  sourcePlatform: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  status: ImportedContentStatus;
  statusLabel: string;
};

export type AiReviewItemView = {
  address: string | null;
  category: string;
  city: string | null;
  confidence: number;
  country: string | null;
  duplicateOf: string | null;
  evidence: string[];
  id: string;
  hasPhoto: boolean;
  imageAlt: string | null;
  imageAttribution: string | null;
  imageUrl: string | null;
  importedPostId: string;
  latitude: number | null;
  locationHint: string | null;
  longitude: number | null;
  name: string;
  providerPhotoName: string | null;
  providerPlaceId: string | null;
  previewAddress: string | null;
  promotedTripSegmentId: string | null;
  reviewReason: "low_confidence" | "needs_location" | "ready";
  sourcePlatform: string;
  status: string;
  travelNote: string | null;
  tripId: string | null;
};

export type TripDraftView = {
  completionStatus: string;
  destination: string;
  id: string;
  placeCount: number;
  places: Array<{
    category: string;
    confidence: number;
    id: string;
    name: string;
    travelNote: string | null;
  }>;
  routeStatus: string;
  suggestedDates: string;
  tripId: string;
  tripName: string;
};

export type TripPickerView = {
  destination: string | null;
  endDate: string | null;
  id: string;
  name: string;
  startDate: string | null;
  travelStyle: TripTravelStyle;
  travelStyleLabel: string;
};

export type ImportsData = {
  error: string | null;
  aiReviewItems: AiReviewItemView[];
  importedContent: ImportedContentView[];
  reviewQueuePrefix?: string;
  sources: Array<{
    connected: boolean;
    id?: string;
    label: string;
    sourceType: string;
    statusLabel: string;
  }>;
  socialImports: ImportedContentView[];
  extractedPlaces: AiReviewItemView[];
  tripDrafts: TripDraftView[];
  trips: TripPickerView[];
  unfiledItems: Array<{
    id: string;
    parseStatus: string;
    promotedTripSegmentId: string | null;
    sourceLabel: string | null;
    sourceType: string;
    title: string;
    tripId: string | null;
  }>;
};

type ImportsClient = ImportSourcesClient & UnfiledItemsClient & {
  from: (
    table:
      | "extracted_places"
      | "import_sources"
      | "import_parse_events"
      | "imported_social_posts"
      | "trips"
      | "unfiled_items"
  ) => any;
};

type TripSelectRow = {
  destination?: string | null;
  end_date?: string | null;
  id: string;
  name?: string;
  start_date?: string | null;
  title?: string;
  travel_style?: string | null;
};

export async function loadImportsData(
  reviewQueuePrefix?: string
): Promise<ImportsData> {
  const auth = await authorizeDashboardApi<ImportsClient>();

  if (!auth) {
    return emptyImportsData("Sign in to load imports.", reviewQueuePrefix);
  }

  const [sources, items, tripsResult, socialWorkspace] = await Promise.all([
    listImportSources(auth.supabase, auth.userId),
    listUnfiledItems(auth.supabase, auth.userId, { status: null, tripId: null }),
    listImportTrips(auth.supabase, auth.userId),
    listSocialImportWorkspace(auth.supabase as any, auth.userId)
  ]);

  if (tripsResult.error) {
    return emptyImportsData("Could not load import workspace data.", reviewQueuePrefix);
  }

  const trips = ((tripsResult.data || []) as TripSelectRow[]).map(mapTripPicker);
  const previewPlaces = await withTimeout(
    enrichReviewPlacePreviews(
      auth.supabase,
      auth.userId,
      socialWorkspace.extractedPlaces,
      socialWorkspace.socialImports,
      trips
    ),
    1200,
    socialWorkspace.extractedPlaces
  );
  const extractedPlaces: AiReviewItemView[] = previewPlaces
    .filter((place: any) => place.status !== "promoted")
    .map((place: any) => {
      const post = socialWorkspace.socialImports.find(
        (source: any) => source.id === place.imported_post_id
      );
      const providerMetadata = readProviderMetadata(place.ai_payload);
      const providerPhoto = readProviderPhoto(providerMetadata);
      const imageUrl = buildPlacePhotoUrl(providerMetadata, 400);

      return {
        address: place.address || null,
        category: place.category || "activity",
        city: place.city || null,
        confidence: Number(place.confidence || 0),
        country: place.country || null,
        duplicateOf: place.duplicate_of || null,
        evidence: readEvidence(place.evidence),
        hasPhoto: Boolean(imageUrl),
        id: place.id,
        imageAlt: providerPhoto?.imageAlt || null,
        imageAttribution: providerPhoto?.attribution || null,
        imageUrl,
        importedPostId: place.imported_post_id,
        latitude: typeof place.latitude === "number" ? place.latitude : null,
        locationHint: readLocationHint(place.ai_payload),
        longitude: typeof place.longitude === "number" ? place.longitude : null,
        name: place.name || "Imported place",
        providerPhotoName: providerPhoto?.photoName || null,
        providerPlaceId: place.place_id || readProviderPlaceId(providerMetadata) || null,
        previewAddress: readFormattedAddress(providerMetadata),
        promotedTripSegmentId: place.promoted_trip_segment_id || null,
        reviewReason: place.status === "needs_location_confirmation"
          ? "needs_location"
          : readReviewReason(place.ai_payload, Number(place.confidence || 0)),
        sourcePlatform: post?.source_platform || "manual",
        status: place.status || "needs_review",
        travelNote: place.travel_note || place.description || null,
        tripId: place.trip_id || null
      };
    });
  const aiReviewItems = extractedPlaces.filter(
    (place) => place.status === "needs_review" || place.status === "needs_location_confirmation"
  );
  const tripDrafts = buildTripDrafts(extractedPlaces, trips);
  const importedContent = socialWorkspace.socialImports.map((post: any) =>
    mapImportedContent(post, extractedPlaces)
  );

  return {
    aiReviewItems,
    error: null,
    importedContent,
    reviewQueuePrefix,
    sources: sources.map((source: any) => ({
      connected: Boolean(source.connected),
      id: source.id,
      label: source.source_label || labelForSource(source.source_type),
      sourceType: source.source_type,
      statusLabel: source.connected ? "Connected" : "Not connected"
    })),
    socialImports: importedContent,
    extractedPlaces,
    tripDrafts,
    trips,
    unfiledItems: items
      .filter((item: any) => item.parse_status !== "promoted")
      .map((item: any) => ({
        id: item.id,
        parseStatus: item.parse_status || "needs_review",
        promotedTripSegmentId: item.promoted_trip_segment_id || null,
        sourceLabel: item.source_label || null,
        sourceType: item.source_type || "manual",
        title: item.title || item.source_label || "Imported item",
        tripId: item.trip_id || null
      }))
  };
}

async function listImportTrips(supabase: ImportsClient, userId: string) {
  const withTravelStyle = await supabase
    .from("trips")
    .select("id,name,title,destination,start_date,end_date,travel_style")
    .eq("user_id", userId)
    .order("start_date", { ascending: true, nullsFirst: false });

  if (!withTravelStyle.error || !isMissingColumn(withTravelStyle.error.message)) {
    return withTravelStyle;
  }

  return supabase
    .from("trips")
    .select("id,name,title,destination,start_date,end_date")
    .eq("user_id", userId)
    .order("start_date", { ascending: true, nullsFirst: false });
}

function emptyImportsData(error: string, reviewQueuePrefix?: string): ImportsData {
  return {
    aiReviewItems: [],
    error,
    importedContent: [],
    reviewQueuePrefix,
    sources: [],
    socialImports: [],
    extractedPlaces: [],
    tripDrafts: [],
    trips: [],
    unfiledItems: []
  };
}

function mapTripPicker(trip: TripSelectRow): TripPickerView {
  const travelStyle = normalizeTravelStyle(trip.travel_style);

  return {
    destination: trip.destination || null,
    endDate: trip.end_date || null,
    id: trip.id,
    name: trip.name || trip.title || "Untitled trip",
    startDate: trip.start_date || null,
    travelStyle,
    travelStyleLabel: TRIP_TRAVEL_STYLE_LABELS[travelStyle]
  };
}

function mapImportedContent(
  post: any,
  extractedPlaces: AiReviewItemView[]
): ImportedContentView {
  const relatedPlaces = extractedPlaces.filter(
    (place: any) => place.importedPostId === post.id
  );
  const hasApprovedPlaces = relatedPlaces.some((place) => place.status === "accepted");
  const status = mapImportedStatus(post.status || "pending", hasApprovedPlaces);

  return {
    createdAt: post.created_at,
    errorMessage: post.error_message || null,
    id: post.id,
    sourcePlatform: post.source_platform || "manual",
    sourceTitle: post.source_title || null,
    sourceUrl: post.source_url || null,
    status,
    statusLabel: importedStatusLabel(status)
  };
}

function mapImportedStatus(
  value: string,
  hasApprovedPlaces: boolean
): ImportedContentStatus {
  if (hasApprovedPlaces) return "approved";
  if (value === "processing") return "scanning";
  if (value === "failed") return "failed";
  if (value === "needs_review" || value === "processed") return "reviewed";
  return "pending";
}

function importedStatusLabel(status: ImportedContentStatus) {
  switch (status) {
    case "approved":
      return "Approved";
    case "failed":
      return "Failed";
    case "pending":
      return "Pending";
    case "reviewed":
      return "Ready to review";
    case "scanning":
      return "Scanning";
  }
}

function buildTripDrafts(
  extractedPlaces: AiReviewItemView[],
  trips: TripPickerView[]
): TripDraftView[] {
  const byTrip = new Map<string, AiReviewItemView[]>();

  for (const place of extractedPlaces) {
    if (place.status !== "accepted" || !place.tripId) continue;
    byTrip.set(place.tripId, [...(byTrip.get(place.tripId) || []), place]);
  }

  return [...byTrip.entries()].map(([tripId, places]) => {
    const trip = trips.find((candidate) => candidate.id === tripId);
    const suggestedDates = formatDraftDates(trip);
    const hasCoordinates = places.some(
      (place) => place.latitude !== null && place.longitude !== null
    );

    return {
      completionStatus: `${places.length} approved place${places.length === 1 ? "" : "s"}`,
      destination: trip?.destination || inferDestination(places),
      id: `draft-${tripId}`,
      placeCount: places.length,
      places: places.map((place) => ({
        category: place.category,
        confidence: place.confidence,
        id: place.id,
        name: place.name,
        travelNote: place.travelNote
      })),
      routeStatus: hasCoordinates ? "Route ready" : "Route needs map matches",
      suggestedDates,
      tripId,
      tripName: trip?.name || "Untitled trip"
    };
  });
}

function formatDraftDates(trip?: TripPickerView) {
  if (!trip?.startDate && !trip?.endDate) return "Dates not set";
  if (trip.startDate && !trip.endDate) return formatDate(trip.startDate);
  if (!trip.startDate && trip.endDate) return formatDate(trip.endDate);
  return `${formatDate(trip.startDate!)} - ${formatDate(trip.endDate!)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function inferDestination(places: AiReviewItemView[]) {
  const address = places.find((place) => place.address)?.address;
  return address?.split(",").slice(-2).join(",").trim() || "Destination not set";
}

function readEvidence(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, 3)
    : [];
}

function readProviderMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const providerMetadata = (value as Record<string, unknown>).providerMetadata;
  return providerMetadata && typeof providerMetadata === "object" && !Array.isArray(providerMetadata)
    ? providerMetadata as Record<string, unknown>
    : null;
}

function readProviderPlaceId(value: Record<string, unknown> | null) {
  return typeof value?.providerPlaceId === "string" && value.providerPlaceId.trim()
    ? value.providerPlaceId.trim()
    : null;
}

async function enrichReviewPlacePreviews(
  supabase: ImportsClient,
  userId: string,
  places: any[],
  posts: any[],
  trips: TripPickerView[]
) {
  const previewable = places
    .filter((place) => place.status === "needs_review" || place.status === "needs_location_confirmation")
    .filter((place) => !readProviderPhoto(readProviderMetadata(place.ai_payload)))
    .filter((place) => shouldPreviewResolve(place))
    .slice(0, 8);

  if (!previewable.length) return places;

  const updates = await Promise.allSettled(
    previewable.map(async (place) => {
      const post = posts.find((source) => source.id === place.imported_post_id);
      const trip = trips.find((candidate) => candidate.id === (place.trip_id || post?.trip_id));
      const destination =
        place.city || readLocationHint(place.ai_payload) || trip?.destination || inferDestinationFromPost(post);
      const resolved = await resolveTravelPlace(
        {
          address: place.address || null,
          city: place.city || destination || null,
          country: place.country || null,
          locationHint: destination || place.address || null,
          name: place.name || "Imported place",
          sourceTitle: post?.source_title || null
        },
        {
          city: place.city || destination || null,
          destination: destination || null,
          tripId: place.trip_id || post?.trip_id || null
        }
      );

      const providerMetadata = resolved.inventoryItem?.metadata;
      if (!providerMetadata || !readProviderPhoto(providerMetadata)) return null;

      const payload = isRecord(place.ai_payload) ? place.ai_payload : {};
      const mergedProviderMetadata = {
        ...(readProviderMetadata(payload) || {}),
        ...providerMetadata,
        formattedAddress:
          readFormattedAddress(providerMetadata) || resolved.address || place.address || null,
        providerPlaceId: resolved.placeId || readProviderPlaceId(providerMetadata)
      };
      const mergedPayload = {
        ...payload,
        providerMetadata: mergedProviderMetadata
      };

      const { error } = await supabase
        .from("extracted_places")
        .update({
          address: place.address || resolved.address || readFormattedAddress(providerMetadata) || null,
          ai_payload: mergedPayload,
          place_id: place.place_id || resolved.placeId || readProviderPlaceId(providerMetadata) || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", place.id)
        .eq("user_id", userId);

      if (error) return null;

      return {
        id: place.id,
        place: {
          ...place,
          address: place.address || resolved.address || readFormattedAddress(providerMetadata) || null,
          ai_payload: mergedPayload,
          place_id: place.place_id || resolved.placeId || readProviderPlaceId(providerMetadata) || null
        }
      };
    })
  );

  const byId = new Map<string, any>();
  for (const update of updates) {
    if (update.status === "fulfilled" && update.value?.id) {
      byId.set(update.value.id, update.value.place);
    }
  }

  return places.map((place) => byId.get(place.id) || place);
}

function shouldPreviewResolve(place: any) {
  const category = String(place.category || "").toLowerCase();
  const payload = isRecord(place.ai_payload) ? place.ai_payload : {};
  const candidateType = String(payload.candidateType || payload.candidate_type || "").toLowerCase();
  if (category.includes("tour") || candidateType === "tour" || candidateType === "activity_idea") {
    return false;
  }
  return Boolean(place.name && String(place.name).trim().length >= 3);
}

function readFormattedAddress(value: Record<string, unknown> | null) {
  return typeof value?.formattedAddress === "string" && value.formattedAddress.trim()
    ? value.formattedAddress.trim()
    : null;
}

function inferDestinationFromPost(post: any) {
  const text = [post?.source_title, post?.source_caption, post?.raw_text]
    .filter(Boolean)
    .join(" ");
  const match =
    text.match(/\bPlanning\s+([A-Z][A-Za-z\s]+?)(?:\s+weekend|\s+trip|:|\.|,|$)/) ||
    text.match(/\bin\s+([A-Z][A-Za-z\s]+?)(?:,|\.|$)/);
  return match?.[1]?.trim() || null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T) {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), timeoutMs);
    })
  ]);
}

function labelForSource(sourceType: string) {
  if (sourceType === "gmail") return "Gmail inbox sync";
  if (sourceType === "outlook") return "Outlook inbox sync";
  if (sourceType === "calendar") return "Calendar feed";
  return "Forwarded email";
}

function readReviewReason(value: unknown, confidence: number): "low_confidence" | "ready" {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "reviewReason" in value &&
    value.reviewReason === "ready"
  ) {
    return "ready";
  }

  return confidence >= 0.85 ? "ready" : "low_confidence";
}

function readLocationHint(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "locationHint" in value &&
    typeof value.locationHint === "string"
  ) {
    return value.locationHint;
  }

  return null;
}

function isMissingColumn(message: string) {
  return /column .*travel_style.* does not exist/i.test(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
