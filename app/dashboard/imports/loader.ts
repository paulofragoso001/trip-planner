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

export type ImportsData = {
  error: string | null;
  reviewQueuePrefix?: string;
  sources: Array<{
    connected: boolean;
    id?: string;
    label: string;
    sourceType: string;
    statusLabel: string;
  }>;
  socialImports: Array<{
    createdAt: string;
    errorMessage: string | null;
    id: string;
    sourcePlatform: string;
    sourceTitle: string | null;
    sourceUrl: string | null;
    status: string;
  }>;
  extractedPlaces: Array<{
    address: string | null;
    category: string;
    confidence: number;
    id: string;
    name: string;
    promotedTripSegmentId: string | null;
    reviewReason: "low_confidence" | "ready";
    sourcePlatform: string;
    status: string;
    travelNote: string | null;
    tripId: string | null;
  }>;
  trips: Array<{
    id: string;
    name: string;
  }>;
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
    auth.supabase
      .from("trips")
      .select("id,name,title")
      .eq("user_id", auth.userId)
      .order("start_date", { ascending: true, nullsFirst: false }),
    listSocialImportWorkspace(auth.supabase as any, auth.userId)
  ]);

  if (tripsResult.error) {
    return emptyImportsData("Could not load import workspace data.", reviewQueuePrefix);
  }

  return {
    error: null,
    reviewQueuePrefix,
    sources: sources.map((source: any) => ({
      connected: Boolean(source.connected),
      id: source.id,
      label: source.source_label || labelForSource(source.source_type),
      sourceType: source.source_type,
      statusLabel: source.connected ? "Connected" : "Not connected"
    })),
    socialImports: socialWorkspace.socialImports.map((post: any) => ({
      createdAt: post.created_at,
      errorMessage: post.error_message || null,
      id: post.id,
      sourcePlatform: post.source_platform || "manual",
      sourceTitle: post.source_title || null,
      sourceUrl: post.source_url || null,
      status: post.status || "pending"
    })),
    extractedPlaces: socialWorkspace.extractedPlaces
      .filter((place: any) => place.status !== "promoted")
      .map((place: any) => {
        const post = socialWorkspace.socialImports.find(
          (source: any) => source.id === place.imported_post_id
        );

        return {
          address: place.address || null,
          category: place.category || "activity",
          confidence: Number(place.confidence || 0),
          id: place.id,
          name: place.name || "Imported place",
          promotedTripSegmentId: place.promoted_trip_segment_id || null,
          reviewReason: readReviewReason(place.ai_payload, Number(place.confidence || 0)),
          sourcePlatform: post?.source_platform || "manual",
          status: place.status || "needs_review",
          travelNote: place.travel_note || place.description || null,
          tripId: place.trip_id || null
        };
      }),
    trips: ((tripsResult.data || []) as Array<{ id: string; name?: string; title?: string }>).map(
      (trip) => ({
        id: trip.id,
        name: trip.name || trip.title || "Untitled trip"
      })
    ),
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

function emptyImportsData(error: string, reviewQueuePrefix?: string): ImportsData {
  return {
    error,
    reviewQueuePrefix,
    sources: [],
    socialImports: [],
    extractedPlaces: [],
    trips: [],
    unfiledItems: []
  };
}

function labelForSource(sourceType: string) {
  if (sourceType === "gmail") return "Gmail inbox sync";
  if (sourceType === "outlook") return "Outlook inbox sync";
  if (sourceType === "calendar") return "Calendar feed";
  return "Forwarded email";
}

function readReviewReason(
  value: unknown,
  confidence: number
): "low_confidence" | "ready" {
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
