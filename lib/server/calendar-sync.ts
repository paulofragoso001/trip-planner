import "server-only";

import { ApiError } from "@/lib/api/errors";
import {
  addDefaultDuration,
  mapSegmentToCalendarEvent
} from "@/lib/calendar/event-mapping";
import type { CalendarProvider, CalendarSyncInput } from "@/lib/validators/calendar-sync";

export type CalendarSyncClient = {
  from: (
    table:
      | "calendar_connections"
      | "calendar_sync_jobs"
      | "calendar_sync_items"
      | "itinerary_items"
      | "trip_segments"
  ) => any;
};

type CalendarSourceSegment = {
  end: string | null;
  location: string | null;
  notes?: string | null;
  sourceId: string;
  sourceType: "itinerary_item" | "trip_segment";
  start: string;
  timeZone?: string | null;
  title: string;
  tripId: string;
  type: string;
  updatedAt?: string | null;
};

const itineraryCalendarSelect =
  "id,title,location,date_time,notes,segment_type,scheduled_departure,estimated_departure,updated_at";
const segmentCalendarSelect = "id,title,location,kind,start_time,end_time,inserted_at";

export async function syncTripToCalendar(
  supabase: CalendarSyncClient,
  userId: string,
  input: CalendarSyncInput
) {
  const connection = await getCalendarConnection(
    supabase,
    userId,
    input.provider,
    input.calendarId
  );

  if (!connection) {
    throw new ApiError(
      "not_implemented",
      `${providerLabel(input.provider)} Calendar is not connected yet.`,
      409,
      {
        connectPath: `/api/calendar/oauth/${input.provider}`,
        provider: input.provider
      }
    );
  }

  const segments = await listCalendarSourceSegments(supabase, userId, input);

  if (segments.length === 0) {
    return {
      calendarId: input.calendarId,
      created: 0,
      message: "No timed trip segments were found to sync.",
      provider: input.provider,
      synced: 0,
      updated: 0
    };
  }

  const pending = await upsertPendingCalendarEvents(
    supabase,
    input,
    connection.id,
    segments
  );
  await enqueueCalendarSyncJob(supabase, connection.id, input);

  return {
    calendarId: input.calendarId,
    created: 0,
    message:
      "Calendar events were staged and queued for the calendar sync worker.",
    provider: input.provider,
    queued: true,
    staged: pending.length,
    synced: 0,
    updated: 0
  };
}

async function getCalendarConnection(
  supabase: CalendarSyncClient,
  userId: string,
  provider: CalendarProvider,
  calendarId: string
) {
  const { data, error } = await supabase
    .from("calendar_connections")
    .select("id,status,provider,default_calendar_id")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    if (isMissingCalendarTable(error.message)) {
      throw new ApiError(
        "not_implemented",
        "Calendar sync tables are not installed. Run migration 016_create_calendar_sync.sql.",
        501,
        { supabaseMessage: error.message }
      );
    }

    throw new ApiError("internal_error", "Could not load calendar connection.", 500, {
      supabaseMessage: error.message
    });
  }

  if (!data) {
    return null;
  }

  if (data.default_calendar_id && data.default_calendar_id !== calendarId) {
    return null;
  }

  return data;
}

async function listCalendarSourceSegments(
  supabase: CalendarSyncClient,
  userId: string,
  input: CalendarSyncInput
) {
  if (!isUuid(input.tripId)) {
    return demoCalendarSegments(input.tripId);
  }

  const [itineraryItems, tripSegments] = await Promise.all([
    listItineraryCalendarItems(supabase, userId, input),
    listTripCalendarSegments(supabase, userId, input)
  ]);

  return [...itineraryItems, ...tripSegments].sort((a, b) =>
    a.start.localeCompare(b.start)
  );
}

async function listItineraryCalendarItems(
  supabase: CalendarSyncClient,
  userId: string,
  input: CalendarSyncInput
): Promise<CalendarSourceSegment[]> {
  let query = supabase
    .from("itinerary_items")
    .select(itineraryCalendarSelect)
    .eq("trip_id", input.tripId)
    .eq("user_id", userId)
    .order("date_time", { ascending: true, nullsFirst: false });

  if (input.segmentIds.length > 0) {
    query = query.in("id", input.segmentIds);
  }

  const { data, error } = await query;

  if (error) {
    if (error.message.includes("public.itinerary_items")) {
      return [];
    }

    throw new ApiError("internal_error", "Could not load itinerary calendar items.", 500, {
      supabaseMessage: error.message
    });
  }

  return (data || [])
    .map((item: Record<string, unknown>) => {
      const start =
        readString(item.scheduled_departure) ||
        readString(item.estimated_departure) ||
        readString(item.date_time);

      if (!start) {
        return null;
      }

      const type = readString(item.segment_type) || "activity";
      const end = addDefaultDuration(start, type);

      return {
        end,
        location: readString(item.location),
        notes: readString(item.notes),
        sourceId: readString(item.id),
        sourceType: "itinerary_item" as const,
        start,
        title: readString(item.title) || "Trip item",
        tripId: input.tripId,
        type,
        updatedAt: readString(item.updated_at)
      };
    })
    .filter((item: CalendarSourceSegment | null): item is CalendarSourceSegment =>
      Boolean(item)
    );
}

async function listTripCalendarSegments(
  supabase: CalendarSyncClient,
  userId: string,
  input: CalendarSyncInput
): Promise<CalendarSourceSegment[]> {
  let query = supabase
    .from("trip_segments")
    .select(segmentCalendarSelect)
    .eq("trip_id", input.tripId)
    .eq("user_id", userId)
    .order("start_time", { ascending: true, nullsFirst: false });

  if (input.segmentIds.length > 0) {
    query = query.in("id", input.segmentIds);
  }

  const { data, error } = await query;

  if (error) {
    if (error.message.includes("public.trip_segments")) {
      return [];
    }

    throw new ApiError("internal_error", "Could not load trip calendar segments.", 500, {
      supabaseMessage: error.message
    });
  }

  return (data || [])
    .map((segment: Record<string, unknown>) => {
      const start = readString(segment.start_time);

      if (!start) {
        return null;
      }

      return {
        end: readString(segment.end_time) || addDefaultDuration(start, readString(segment.kind)),
        location: readString(segment.location),
        sourceId: readString(segment.id),
        sourceType: "trip_segment" as const,
        start,
        title: readString(segment.title) || "Trip segment",
        tripId: input.tripId,
        type: readString(segment.kind) || "activity",
        updatedAt: readString(segment.inserted_at)
      };
    })
    .filter((item: CalendarSourceSegment | null): item is CalendarSourceSegment =>
      Boolean(item)
    );
}

async function upsertPendingCalendarEvents(
  supabase: CalendarSyncClient,
  input: CalendarSyncInput,
  connectionId: string,
  segments: CalendarSourceSegment[]
) {
  if (!isUuid(input.tripId)) {
    return segments.map((segment) => ({
      id: segment.sourceId,
      source_id: segment.sourceId,
      sync_status: "pending"
    }));
  }

  const rows = segments.map((segment) => {
    const eventInput = mapSegmentToCalendarEvent(segment, input.calendarId);

    return {
      connection_id: connectionId,
      event_end: eventInput.endAt,
      event_payload: eventInput,
      event_start: eventInput.startAt,
      event_title: eventInput.title,
      provider_calendar_id: input.calendarId,
      provider_event_etag: null,
      wayline_sync_version: eventInput.wayline.syncVersion,
      wayline_updated_at: eventInput.wayline.updatedAt,
      source_id: segment.sourceId,
      source_type: segment.sourceType,
      sync_status: "pending",
      trip_id: input.tripId
    };
  });

  const { data, error } = await supabase
    .from("calendar_sync_items")
    .upsert(rows, {
      onConflict: "connection_id,source_type,source_id"
    })
    .select("id,source_id,sync_status");

  if (error) {
    if (isMissingCalendarTable(error.message)) {
      throw new ApiError(
        "not_implemented",
        "Calendar sync tables are not installed. Run migration 016_create_calendar_sync.sql.",
        501,
        { supabaseMessage: error.message }
      );
    }

    throw new ApiError("internal_error", "Could not stage calendar events.", 500, {
      supabaseMessage: error.message
    });
  }

  return data || [];
}

async function enqueueCalendarSyncJob(
  supabase: CalendarSyncClient,
  connectionId: string,
  input: CalendarSyncInput
) {
  if (!isUuid(input.tripId)) {
    return;
  }

  const payload = {
    calendarId: input.calendarId,
    provider: input.provider,
    segmentIds: input.segmentIds
  };
  const { error } = await supabase.from("calendar_sync_jobs").upsert(
    {
      connection_id: connectionId,
      idempotency_key: buildCalendarSyncJobId(connectionId, input.tripId, payload),
      job_type: "reconcile",
      payload,
      status: "queued",
      trip_id: input.tripId
    },
    { onConflict: "idempotency_key" }
  );

  if (error) {
    if (isMissingCalendarTable(error.message)) {
      throw new ApiError(
        "not_implemented",
        "Calendar sync tables are not installed. Run migration 016_create_calendar_sync.sql.",
        501,
        { supabaseMessage: error.message }
      );
    }

    throw new ApiError("internal_error", "Could not queue calendar sync job.", 500, {
      supabaseMessage: error.message
    });
  }
}

function providerLabel(provider: CalendarProvider) {
  return provider === "google" ? "Google" : "Outlook";
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isMissingCalendarTable(message: string) {
  return (
    message.includes("calendar_connections") ||
    message.includes("calendar_sync_jobs") ||
    message.includes("calendar_sync_items")
  );
}

function buildCalendarSyncJobId(
  connectionId: string,
  tripId: string,
  payload: Record<string, unknown>
) {
  return [
    "calendar",
    connectionId,
    tripId,
    "reconcile",
    JSON.stringify(payload, Object.keys(payload).sort())
  ].join(":");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function demoCalendarSegments(tripId: string): CalendarSourceSegment[] {
  return [
    {
      end: "2026-06-11T23:05:00.000Z",
      location: "Miami International to Barcelona El Prat",
      sourceId: "flight-demo",
      sourceType: "trip_segment",
      start: "2026-06-11T09:15:00.000Z",
      title: "MIA to BCN",
      tripId,
      type: "flight",
      updatedAt: "2026-05-25T00:00:00.000Z"
    },
    {
      end: "2026-06-11T16:00:00.000Z",
      location: "Hotel Arts Barcelona, Marina 19-21",
      sourceId: "hotel-arts",
      sourceType: "trip_segment",
      start: "2026-06-11T15:00:00.000Z",
      title: "Hotel Arts check-in",
      tripId,
      type: "hotel",
      updatedAt: "2026-05-25T00:00:00.000Z"
    },
    {
      end: "2026-06-11T21:30:00.000Z",
      location: "El Born, Barcelona",
      sourceId: "team-dinner",
      sourceType: "trip_segment",
      start: "2026-06-11T19:30:00.000Z",
      title: "Team dinner",
      tripId,
      type: "dinner",
      updatedAt: "2026-05-25T00:00:00.000Z"
    }
  ];
}
