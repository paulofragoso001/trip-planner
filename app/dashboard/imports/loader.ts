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
  from: (table: "import_sources" | "import_parse_events" | "trips" | "unfiled_items") => any;
};

export async function loadImportsData(
  reviewQueuePrefix?: string
): Promise<ImportsData> {
  const auth = await authorizeDashboardApi<ImportsClient>();

  if (!auth) {
    return emptyImportsData("Sign in to load imports.", reviewQueuePrefix);
  }

  const [sources, items, tripsResult] = await Promise.all([
    listImportSources(auth.supabase, auth.userId),
    listUnfiledItems(auth.supabase, auth.userId, { status: null, tripId: null }),
    auth.supabase
      .from("trips")
      .select("id,name,title")
      .eq("user_id", auth.userId)
      .order("start_date", { ascending: true, nullsFirst: false })
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
