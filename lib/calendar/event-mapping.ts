import "server-only";

import type { CalendarEventInput } from "@/lib/calendar/types";

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

export function mapSegmentToCalendarEvent(
  segment: CalendarSourceSegment,
  calendarId: string
): CalendarEventInput {
  return {
    calendarId,
    description: segment.notes ?? buildDefaultDescription(segment),
    endAt: segment.end ?? addDefaultDuration(segment.start, segment.type),
    externalUrl: null,
    location: segment.location,
    reminders: defaultRemindersForSegment(segment.type),
    sourceId: segment.sourceId,
    sourceType: segment.sourceType,
    startAt: segment.start,
    status: "confirmed",
    timeZone: segment.timeZone ?? null,
    title: segment.title,
    wayline: {
      source: "wayline",
      syncVersion: buildAlmidySyncVersion(segment),
      tripId: segment.tripId,
      updatedAt: segment.updatedAt ?? new Date().toISOString()
    }
  };
}

export function toGoogleCalendarEvent(input: CalendarEventInput) {
  return {
    attendees: input.attendees?.map((attendee) => ({
      displayName: attendee.name ?? undefined,
      email: attendee.email,
      optional: attendee.optional
    })),
    description: input.description ?? undefined,
    end: {
      dateTime: input.endAt,
      timeZone: input.timeZone ?? undefined
    },
    extendedProperties: {
      private: {
        waylineSegmentId: input.sourceId,
        waylineSourceId: input.sourceId,
        waylineSourceType: input.sourceType,
        waylineSource: input.wayline.source,
        waylineSyncVersion: input.wayline.syncVersion,
        waylineTripId: input.wayline.tripId,
        waylineUpdatedAt: input.wayline.updatedAt
      }
    },
    location: input.location ?? undefined,
    reminders: input.reminders
      ? {
          overrides: input.reminders.map((reminder) => ({
            method: reminder.method,
            minutes: reminder.minutesBeforeStart
          })),
          useDefault: false
        }
      : undefined,
    source: input.externalUrl
      ? {
          title: "Almidy",
          url: input.externalUrl
        }
      : undefined,
    start: {
      dateTime: input.startAt,
      timeZone: input.timeZone ?? undefined
    },
    status: input.status,
    summary: input.title
  };
}

export function toMicrosoftGraphEvent(input: CalendarEventInput) {
  return {
    attendees: input.attendees?.map((attendee) => ({
      emailAddress: {
        address: attendee.email,
        name: attendee.name ?? attendee.email
      },
      type: attendee.optional ? "optional" : "required"
    })),
    body: {
      content: input.description ?? "",
      contentType: "text"
    },
    end: {
      dateTime: input.endAt,
      timeZone: input.timeZone ?? "UTC"
    },
    extensions: [
      {
        "@odata.type": "microsoft.graph.openTypeExtension",
        extensionName: "com.wayline.tripSync",
        waylineSegmentId: input.sourceId,
        waylineSourceId: input.sourceId,
        waylineSourceType: input.sourceType,
        waylineSource: input.wayline.source,
        waylineSyncVersion: input.wayline.syncVersion,
        waylineTripId: input.wayline.tripId,
        waylineUpdatedAt: input.wayline.updatedAt
      }
    ],
    isReminderOn: Boolean(input.reminders?.length),
    location: input.location
      ? {
          displayName: input.location
        }
      : undefined,
    reminderMinutesBeforeStart: input.reminders?.[0]?.minutesBeforeStart,
    start: {
      dateTime: input.startAt,
      timeZone: input.timeZone ?? "UTC"
    },
    subject: input.title
  };
}

export function addDefaultDuration(start: string, type: string | null) {
  const date = new Date(start);

  if (Number.isNaN(date.getTime())) {
    return start;
  }

  const hours =
    type === "hotel" || type === "lodging" ? 24 : type === "flight" || type === "air" ? 3 : 1;
  date.setHours(date.getHours() + hours);

  return date.toISOString();
}

function defaultRemindersForSegment(type: string) {
  if (type === "flight" || type === "air") {
    return [{ method: "popup" as const, minutesBeforeStart: 180 }];
  }

  if (type === "meeting") {
    return [{ method: "popup" as const, minutesBeforeStart: 30 }];
  }

  return [{ method: "popup" as const, minutesBeforeStart: 60 }];
}

function buildDefaultDescription(segment: CalendarSourceSegment) {
  return `Synced from Almidy ${segment.sourceType.replace("_", " ")} ${segment.sourceId}.`;
}

function buildAlmidySyncVersion(segment: CalendarSourceSegment) {
  return [
    segment.sourceType,
    segment.sourceId,
    segment.updatedAt ?? segment.start,
    segment.end ?? "",
    segment.title
  ].join(":");
}
