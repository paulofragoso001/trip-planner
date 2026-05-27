import "server-only";

import { toGoogleCalendarEvent } from "@/lib/calendar/event-mapping";
import type {
  CalendarEventInput,
  CalendarProviderEvent,
  CalendarProviderAdapter,
  CalendarSummary,
  ExternalEventRef
} from "@/lib/calendar/types";

export class GoogleCalendarProvider implements CalendarProviderAdapter {
  constructor(private readonly accessToken: string) {}

  async listCalendars(): Promise<CalendarSummary[]> {
    const payload = await this.request<{ items?: Array<Record<string, unknown>> }>(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList"
    );

    return (payload.items || []).map((calendar) => ({
      id: readString(calendar.id),
      name: readString(calendar.summary) || "Calendar",
      primary: calendar.primary === true,
      provider: "google",
      timeZone: readString(calendar.timeZone) || null
    }));
  }

  async createEvent(input: CalendarEventInput): Promise<ExternalEventRef> {
    const payload = await this.request<Record<string, unknown>>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events`,
      {
        body: JSON.stringify(toGoogleCalendarEvent(input)),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }
    );

    return this.toExternalRef(input.calendarId, payload);
  }

  async updateEvent(
    calendarId: string,
    externalEventId: string,
    input: CalendarEventInput
  ): Promise<ExternalEventRef> {
    const payload = await this.request<Record<string, unknown>>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalEventId)}`,
      {
        body: JSON.stringify(toGoogleCalendarEvent(input)),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      }
    );

    return this.toExternalRef(calendarId, payload);
  }

  async findEventByMetadata(
    calendarId: string,
    metadata: { segmentId: string; tripId: string }
  ): Promise<CalendarProviderEvent | null> {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    );
    url.searchParams.append("privateExtendedProperty", `waylineSegmentId=${metadata.segmentId}`);
    url.searchParams.append("privateExtendedProperty", `waylineTripId=${metadata.tripId}`);
    url.searchParams.set("showDeleted", "false");
    url.searchParams.set("singleEvents", "true");

    const payload = await this.request<{ items?: Array<Record<string, unknown>> }>(
      url.toString()
    );
    const event = payload.items?.[0];

    return event ? this.toProviderEvent(calendarId, event) : null;
  }

  async getEvent(
    calendarId: string,
    externalEventId: string
  ): Promise<CalendarProviderEvent | null> {
    const response = await this.rawRequest(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalEventId)}`
    );

    if (response.status === 404 || response.status === 410) {
      return null;
    }

    return this.toProviderEvent(calendarId, await this.readResponse<Record<string, unknown>>(response));
  }

  async deleteEvent(calendarId: string, externalEventId: string) {
    const response = await this.rawRequest(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalEventId)}`,
      { method: "DELETE" }
    );

    if (response.status === 404 || response.status === 410) {
      return;
    }

    await this.readResponse(response);
  }

  private async request<TPayload>(url: string, init: RequestInit = {}) {
    return this.readResponse<TPayload>(await this.rawRequest(url, init));
  }

  private async rawRequest(url: string, init: RequestInit = {}) {
    return fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...init.headers
      }
    });
  }

  private async readResponse<TPayload>(response: Response) {
    if (!response.ok) {
      throw new Error(`Google Calendar request failed (${response.status}).`);
    }

    if (response.status === 204) {
      return {} as TPayload;
    }

    return (await response.json()) as TPayload;
  }

  private toExternalRef(calendarId: string, payload: Record<string, unknown>) {
    return {
      calendarId,
      externalEventId: readString(payload.id),
      htmlLink: readString(payload.htmlLink) || null,
      provider: "google" as const,
      syncVersion: readString(payload.etag) || null
    };
  }

  private toProviderEvent(
    calendarId: string,
    payload: Record<string, unknown>
  ): CalendarProviderEvent {
    const privateMetadata = readPrivateExtendedProperties(payload);

    return {
      ...this.toExternalRef(calendarId, payload),
      metadata: {
        segmentId: privateMetadata.waylineSegmentId,
        source: privateMetadata.waylineSource === "wayline" ? "wayline" : undefined,
        sourceId: privateMetadata.waylineSourceId,
        syncVersion: privateMetadata.waylineSyncVersion,
        tripId: privateMetadata.waylineTripId,
        updatedAt: privateMetadata.waylineUpdatedAt
      }
    };
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readPrivateExtendedProperties(payload: Record<string, unknown>) {
  const extendedProperties = payload.extendedProperties;
  if (!extendedProperties || typeof extendedProperties !== "object") {
    return {} as Record<string, string | undefined>;
  }

  const privateProperties = (extendedProperties as Record<string, unknown>).private;
  if (!privateProperties || typeof privateProperties !== "object") {
    return {} as Record<string, string | undefined>;
  }

  return privateProperties as Record<string, string | undefined>;
}
