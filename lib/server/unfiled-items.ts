import "server-only";

import { ApiError } from "@/lib/api/errors";
import {
  normalizeSegmentType,
  type CreateUnfiledItemInput,
  type UpdateUnfiledItemInput,
  type UnfiledItemsQuery
} from "@/lib/validators/unfiled-items";

export type UnfiledItemsClient = {
  from: (table: "import_parse_events" | "trip_segments" | "unfiled_items") => any;
};

const unfiledSelect =
  "id,user_id,trip_id,source_type,source_label,raw_text,parsed_payload,parse_status,parse_confidence,title,location,date_time,segment_type,notes,promoted_itinerary_item_id,promoted_trip_segment_id,created_at,updated_at";
const missingUnfiledItemsTableMessage =
  "Could not find the table 'public.unfiled_items'";
const missingImportParseEventsTableMessage =
  "Could not find the table 'public.import_parse_events'";

export async function listUnfiledItems(
  supabase: UnfiledItemsClient,
  userId: string,
  queryInput: UnfiledItemsQuery
) {
  let query = supabase
    .from("unfiled_items")
    .select(unfiledSelect)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (queryInput.status) {
    query = query.eq("parse_status", queryInput.status);
  }

  if (queryInput.tripId) {
    query = query.eq("trip_id", queryInput.tripId);
  }

  const { data, error } = await query;

  if (error) {
    if (error.message.includes(missingUnfiledItemsTableMessage)) {
      return [];
    }

    throw new ApiError("internal_error", "Could not load unfiled items.", 500, {
      supabaseMessage: error.message
    });
  }

  return data || [];
}

export async function createUnfiledItem(
  supabase: UnfiledItemsClient,
  userId: string,
  input: CreateUnfiledItemInput
) {
  const parsed = parseUnfiledText(input.rawText, input);
  const { data, error } = await supabase
    .from("unfiled_items")
    .insert({
      date_time: parsed.dateTime,
      location: parsed.location,
      notes: parsed.notes,
      parse_confidence: parsed.confidence,
      parse_status: parsed.status,
      parsed_payload: parsed.payload,
      raw_text: input.rawText || null,
      segment_type: parsed.segmentType,
      source_label: input.sourceLabel,
      source_type: input.sourceType,
      title: parsed.title,
      trip_id: input.tripId,
      user_id: userId
    })
    .select(unfiledSelect)
    .single();

  if (error) {
    if (error.message.includes(missingUnfiledItemsTableMessage)) {
      throw new ApiError(
        "not_implemented",
        "Run migration 011_create_unfiled_items.sql before importing confirmations.",
        501
      );
    }

    throw new ApiError("internal_error", "Could not create unfiled item.", 500, {
      supabaseMessage: error.message
    });
  }

  await recordImportParseEvent(supabase, userId, {
    confidence: parsed.confidence,
    eventType: "prediction",
    finalPayload: buildUnfiledSnapshot(data),
    finalSegmentType: readString(data.segment_type),
    inputExcerpt: excerpt(input.rawText),
    predictedPayload: parsed.payload,
    predictedSegmentType: parsed.segmentType,
    sourceLabel: input.sourceLabel,
    sourceType: input.sourceType,
    tripId: readString(data.trip_id),
    unfiledItemId: readString(data.id)
  });

  return data;
}

export async function updateUnfiledItem(
  supabase: UnfiledItemsClient,
  userId: string,
  id: string,
  input: UpdateUnfiledItemInput
) {
  const existing = await getUnfiledItem(supabase, userId, id);
  const updates: Record<string, unknown> = {};

  if ("tripId" in input) updates.trip_id = input.tripId || null;
  if ("parseStatus" in input) updates.parse_status = input.parseStatus;
  if ("title" in input) updates.title = input.title || null;
  if ("location" in input) updates.location = input.location || null;
  if ("dateTime" in input) updates.date_time = input.dateTime || null;
  if ("segmentType" in input) updates.segment_type = input.segmentType || "activity";
  if ("notes" in input) updates.notes = input.notes || null;
  if ("promotedItineraryItemId" in input) {
    updates.promoted_itinerary_item_id = input.promotedItineraryItemId || null;
  }
  if ("promotedTripSegmentId" in input) {
    updates.promoted_trip_segment_id = input.promotedTripSegmentId || null;
  }

  const { data, error } = await supabase
    .from("unfiled_items")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select(unfiledSelect)
    .single();

  if (error) {
    throw new ApiError("internal_error", "Could not update unfiled item.", 500, {
      supabaseMessage: error.message
    });
  }

  await recordImportParseEvent(supabase, userId, {
    correctionPayload: buildCorrectionPayload(existing, data),
    eventType: eventTypeForUpdate(input),
    finalPayload: buildUnfiledSnapshot(data),
    finalSegmentType: readString(data.segment_type),
    previousPayload: buildUnfiledSnapshot(existing),
    predictedPayload: readRecord(existing.parsed_payload),
    predictedSegmentType: readString(existing.segment_type),
    sourceLabel: readString(data.source_label),
    sourceType: readString(data.source_type) || "manual",
    tripId: readString(data.trip_id),
    unfiledItemId: readString(data.id)
  });

  return data;
}

export async function deleteUnfiledItem(
  supabase: UnfiledItemsClient,
  userId: string,
  id: string
) {
  const { error } = await supabase
    .from("unfiled_items")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new ApiError("internal_error", "Could not delete unfiled item.", 500, {
      supabaseMessage: error.message
    });
  }
}

export async function promoteUnfiledItem(
  supabase: UnfiledItemsClient,
  userId: string,
  id: string,
  tripId: string
) {
  const existing = await getUnfiledItem(supabase, userId, id);

  if (readString(existing.parse_status) === "promoted") {
    return existing;
  }

  const title = readString(existing.title) || readString(existing.source_label) || "Imported plan";
  const segmentType = readString(existing.segment_type) || "activity";
  const { data: latestSegment } = await supabase
    .from("trip_segments")
    .select("position")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .order("position", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const nextPosition =
    typeof latestSegment?.position === "number" ? latestSegment.position + 1 : 0;

  const { data: segment, error: segmentError } = await supabase
    .from("trip_segments")
    .insert({
      kind: segmentType,
      location: readString(existing.location),
      notes: readString(existing.notes) || readString(existing.raw_text),
      position: nextPosition,
      start_time: readString(existing.date_time),
      title,
      trip_id: tripId,
      user_id: userId
    })
    .select("id,trip_id,user_id,kind,title,start_time,end_time,location,inserted_at")
    .single();

  if (segmentError) {
    throw new ApiError("internal_error", "Could not promote unfiled item.", 500, {
      supabaseMessage: segmentError.message
    });
  }

  const promoted = await updateUnfiledItem(supabase, userId, id, {
    parseStatus: "promoted",
    promotedTripSegmentId: readString(segment.id),
    tripId
  });

  return {
    item: promoted,
    segment
  };
}

async function getUnfiledItem(
  supabase: UnfiledItemsClient,
  userId: string,
  id: string
) {
  const { data, error } = await supabase
    .from("unfiled_items")
    .select(unfiledSelect)
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    throw new ApiError("internal_error", "Could not load unfiled item.", 500, {
      supabaseMessage: error.message
    });
  }

  return data as Record<string, unknown>;
}

async function recordImportParseEvent(
  supabase: UnfiledItemsClient,
  userId: string,
  input: {
    confidence?: number | null;
    correctionPayload?: Record<string, unknown>;
    eventType: "correction" | "dismissal" | "prediction" | "promotion";
    finalPayload?: Record<string, unknown>;
    finalSegmentType?: string | null;
    inputExcerpt?: string | null;
    predictedPayload?: Record<string, unknown>;
    predictedSegmentType?: string | null;
    previousPayload?: Record<string, unknown>;
    sourceLabel?: string | null;
    sourceType: string;
    tripId?: string | null;
    unfiledItemId?: string | null;
  }
) {
  const { error } = await supabase.from("import_parse_events").insert({
    confidence: input.confidence ?? null,
    correction_payload: input.correctionPayload || {},
    event_type: input.eventType,
    final_payload: input.finalPayload || {},
    final_segment_type: input.finalSegmentType || null,
    input_excerpt: input.inputExcerpt || null,
    parser_name: "wayline_rules",
    parser_version: "v1",
    predicted_payload: input.predictedPayload || {},
    predicted_segment_type: input.predictedSegmentType || null,
    previous_payload: input.previousPayload || {},
    source_label: input.sourceLabel || null,
    source_type: input.sourceType,
    trip_id: input.tripId || null,
    unfiled_item_id: input.unfiledItemId || null,
    user_id: userId
  });

  if (error && !error.message.includes(missingImportParseEventsTableMessage)) {
    console.warn("Could not record import parse event.", error.message);
  }
}

function eventTypeForUpdate(input: UpdateUnfiledItemInput) {
  if (input.parseStatus === "promoted") {
    return "promotion";
  }

  if (input.parseStatus === "dismissed") {
    return "dismissal";
  }

  return "correction";
}

function buildUnfiledSnapshot(item: Record<string, unknown>) {
  return {
    date_time: readString(item.date_time),
    location: readString(item.location),
    notes: readString(item.notes),
    parse_status: readString(item.parse_status),
    segment_type: readString(item.segment_type),
    title: readString(item.title),
    trip_id: readString(item.trip_id)
  };
}

function buildCorrectionPayload(
  previous: Record<string, unknown>,
  next: Record<string, unknown>
) {
  const fields = [
    "date_time",
    "location",
    "notes",
    "parse_status",
    "segment_type",
    "title",
    "trip_id"
  ];
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  for (const field of fields) {
    const from = previous[field] ?? null;
    const to = next[field] ?? null;
    if (from !== to) {
      changes[field] = { from, to };
    }
  }

  return changes;
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function excerpt(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

function parseUnfiledText(rawText: string, input: CreateUnfiledItemInput) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = input.title || lines[0] || null;
  const location =
    input.location || findValue(lines, ["location", "address", "venue", "hotel"]) || null;
  const dateTime = input.dateTime || findIsoLikeDate(rawText) || null;
  const segmentType =
    input.segmentType || normalizeSegmentType(inferSegmentType(rawText)) || "activity";
  const notes = input.notes || rawText || null;
  const confidence = Math.min(
    0.95,
    0.25 + (title ? 0.25 : 0) + (location ? 0.2 : 0) + (dateTime ? 0.25 : 0)
  );

  return {
    confidence,
    dateTime,
    location,
    notes,
    payload: {
      date_time: dateTime,
      location,
      segment_type: segmentType,
      title
    },
    segmentType,
    status: confidence >= 0.7 ? "ready" : "needs_review",
    title
  };
}

function findValue(lines: string[], keys: string[]) {
  for (const line of lines) {
    const [key, ...rest] = line.split(":");
    if (key && rest.length && keys.includes(key.trim().toLowerCase())) {
      return rest.join(":").trim();
    }
  }

  return undefined;
}

function findIsoLikeDate(value: string) {
  return value.match(/\d{4}-\d{2}-\d{2}(?:[T ][0-2]\d:[0-5]\d)?/)?.[0] ?? undefined;
}

function inferSegmentType(value: string) {
  const lower = value.toLowerCase();

  if (lower.includes("flight") || lower.includes("airline")) return "flight";
  if (lower.includes("hotel") || lower.includes("room")) return "hotel";
  if (lower.includes("meeting") || lower.includes("calendar")) return "meeting";
  if (lower.includes("restaurant") || lower.includes("reservation")) return "restaurant";
  if (lower.includes("car") || lower.includes("rental")) return "transport";
  return "activity";
}
