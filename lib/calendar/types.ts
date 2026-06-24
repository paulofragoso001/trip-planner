import "server-only";

import type { CalendarProvider as CalendarProviderName } from "@/lib/validators/calendar-sync";

export type CalendarSummary = {
  id: string;
  name: string;
  primary?: boolean;
  provider: CalendarProviderName;
  timeZone?: string | null;
};

export type CalendarAttendee = {
  email: string;
  name?: string | null;
  optional?: boolean;
};

export type CalendarReminder = {
  method: "email" | "popup";
  minutesBeforeStart: number;
};

export type CalendarEventInput = {
  attendees?: CalendarAttendee[];
  calendarId: string;
  description?: string | null;
  endAt: string;
  externalUrl?: string | null;
  location?: string | null;
  reminders?: CalendarReminder[];
  sourceId: string;
  sourceType: "itinerary_item" | "trip_segment";
  startAt: string;
  status?: "confirmed" | "cancelled" | "tentative";
  timeZone?: string | null;
  title: string;
  wayline: CalendarEventAlmidyMetadata;
};

export type CalendarEventAlmidyMetadata = {
  source: "wayline";
  syncVersion: string;
  tripId: string;
  updatedAt: string;
};

export type ExternalEventRef = {
  calendarId: string;
  externalEventId: string;
  htmlLink?: string | null;
  provider: CalendarProviderName;
  syncVersion?: string | null;
};

export type CalendarProviderEvent = ExternalEventRef & {
  metadata?: Partial<CalendarEventAlmidyMetadata> & {
    segmentId?: string;
    sourceId?: string;
  };
};

export type CalendarChange = {
  externalEventId: string;
  kind: "created" | "updated" | "deleted";
};

export type CalendarProviderAdapter = {
  createEvent(input: CalendarEventInput): Promise<ExternalEventRef>;
  deleteEvent(calendarId: string, externalEventId: string): Promise<void>;
  findEventByMetadata?(
    calendarId: string,
    metadata: Pick<CalendarEventAlmidyMetadata, "tripId"> & { segmentId: string }
  ): Promise<CalendarProviderEvent | null>;
  getEvent?(calendarId: string, externalEventId: string): Promise<CalendarProviderEvent | null>;
  listCalendars(): Promise<CalendarSummary[]>;
  syncChanges?(
    cursor?: string
  ): Promise<{ changes: CalendarChange[]; cursor: string }>;
  updateEvent(
    calendarId: string,
    externalEventId: string,
    input: CalendarEventInput
  ): Promise<ExternalEventRef>;
};
