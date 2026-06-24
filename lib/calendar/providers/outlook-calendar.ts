import "server-only";

import { toMicrosoftGraphEvent } from "@/lib/calendar/event-mapping";
import type {
  CalendarEventInput,
  CalendarProviderEvent,
  CalendarProviderAdapter,
  CalendarSummary,
  ExternalEventRef
} from "@/lib/calendar/types";

export class OutlookCalendarProvider implements CalendarProviderAdapter {
  constructor(private readonly accessToken: string) {}

  async listCalendars(): Promise<CalendarSummary[]> {
    const payload = await this.request<{ value?: Array<Record<string, unknown>> }>(
      "https://graph.microsoft.com/v1.0/me/calendars"
    );

    return (payload.value || []).map((calendar) => ({
      id: readString(calendar.id),
      name: readString(calendar.name) || "Calendar",
      provider: "outlook",
      timeZone: null
    }));
  }

  async createEvent(input: CalendarEventInput): Promise<ExternalEventRef> {
    const payload = await this.request<Record<string, unknown>>(
      `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(input.calendarId)}/events`,
      {
        body: JSON.stringify(toMicrosoftGraphEvent(input)),
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
      `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalEventId)}`,
      {
        body: JSON.stringify(toMicrosoftGraphEvent(input)),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      }
    );

    return this.toExternalRef(calendarId, payload);
  }

  async getEvent(
    calendarId: string,
    externalEventId: string
  ): Promise<CalendarProviderEvent | null> {
    const url = new URL(
      `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalEventId)}`
    );
    url.searchParams.set("$expand", "extensions");
    const response = await this.rawRequest(url.toString());

    if (response.status === 404 || response.status === 410) {
      return null;
    }

    return this.toProviderEvent(calendarId, await this.readResponse<Record<string, unknown>>(response));
  }

  async deleteEvent(calendarId: string, externalEventId: string) {
    const response = await this.rawRequest(
      `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalEventId)}`,
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
      throw new Error(`Microsoft Graph calendar request failed (${response.status}).`);
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
      htmlLink: readString(payload.webLink) || null,
      provider: "outlook" as const,
      syncVersion: readString(payload.changeKey) || null
    };
  }

  private toProviderEvent(
    calendarId: string,
    payload: Record<string, unknown>
  ): CalendarProviderEvent {
    const metadata = readAlmidyExtension(payload);

    return {
      ...this.toExternalRef(calendarId, payload),
      metadata: metadata
        ? {
            segmentId: metadata.waylineSegmentId,
            source: metadata.waylineSource === "wayline" ? "wayline" : undefined,
            sourceId: metadata.waylineSourceId,
            syncVersion: metadata.waylineSyncVersion,
            tripId: metadata.waylineTripId,
            updatedAt: metadata.waylineUpdatedAt
          }
        : undefined
    };
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readAlmidyExtension(payload: Record<string, unknown>) {
  const extensions = payload.extensions;
  if (!Array.isArray(extensions)) {
    return null;
  }

  const extension = extensions.find(
    (item) =>
      item &&
      typeof item === "object" &&
      (item as Record<string, unknown>).extensionName === "com.wayline.tripSync"
  );

  return extension && typeof extension === "object"
    ? (extension as Record<string, string | undefined>)
    : null;
}
