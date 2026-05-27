import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type ImportParseEventDetail = {
  confidence: number | null;
  correction_payload: Record<string, unknown>;
  created_at: string;
  event_type: string;
  final_payload: Record<string, unknown>;
  final_segment_type: string | null;
  id: string;
  input_excerpt: string | null;
  parser_name: string;
  parser_version: string;
  predicted_payload: Record<string, unknown>;
  predicted_segment_type: string | null;
  previous_payload: Record<string, unknown>;
  source_label: string | null;
  source_type: string;
  unfiled_item_id: string | null;
  user_id: string;
};

export type ImportParseEventSource = {
  id: string;
  parse_status: string | null;
  segment_type: string | null;
  source_label: string | null;
  source_type: string | null;
  title: string | null;
  trip_id: string | null;
};

export type ImportParseEventDetailReport =
  | {
      error: string;
      event: null;
      source: null;
    }
  | {
      error: null;
      event: ImportParseEventDetail;
      source: ImportParseEventSource | null;
    };

export async function getImportParseEventDetail(
  eventId: string
): Promise<ImportParseEventDetailReport> {
  const admin = createAdminClient();

  if (!admin) {
    return {
      error: "SUPABASE_SERVICE_ROLE_KEY is not configured.",
      event: null,
      source: null
    };
  }

  const eventResult = await admin
    .from("import_parse_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();

  if (eventResult.error) {
    return {
      error: eventResult.error.message,
      event: null,
      source: null
    };
  }

  if (!eventResult.data) {
    return {
      error: "Import parse event not found.",
      event: null,
      source: null
    };
  }

  const event = eventResult.data as ImportParseEventDetail;

  if (!event.unfiled_item_id) {
    return {
      error: null,
      event,
      source: null
    };
  }

  const sourceResult = await admin
    .from("unfiled_items")
    .select("id,parse_status,segment_type,source_label,source_type,title,trip_id")
    .eq("id", event.unfiled_item_id)
    .maybeSingle();

  return {
    error: null,
    event,
    source: sourceResult.error ? null : ((sourceResult.data || null) as ImportParseEventSource | null)
  };
}
