export const calendarProviders = ["google", "outlook"] as const;

export type CalendarProvider = (typeof calendarProviders)[number];

export type CalendarSyncInput = {
  calendarId: string;
  provider: CalendarProvider;
  segmentIds: string[];
  tripId: string;
};

type ValidationResult<TValue> =
  | { ok: true; value: TValue }
  | { details: Record<string, string>; ok: false };

export function validateCalendarSyncInput(
  value: unknown
): ValidationResult<CalendarSyncInput> {
  if (!isRecord(value)) {
    return {
      details: { body: "Expected a JSON object." },
      ok: false
    };
  }

  const details: Record<string, string> = {};
  const provider = normalizeCalendarProvider(value.provider);
  const tripId = readString(value.tripId, "tripId", details, 120);
  const calendarId = readString(value.calendarId ?? "primary", "calendarId", details, 240);
  const segmentIds = readOptionalStringArray(value.segmentIds, "segmentIds", details);

  if (!provider) {
    details.provider = "Expected google or outlook.";
  }

  if (Object.keys(details).length > 0 || !provider || !tripId || !calendarId) {
    return { details, ok: false };
  }

  return {
    ok: true,
    value: {
      calendarId,
      provider,
      segmentIds,
      tripId
    }
  };
}

export function normalizeCalendarProvider(value: unknown): CalendarProvider | null {
  const provider = typeof value === "string" ? value.trim().toLowerCase() : "";

  return calendarProviders.includes(provider as CalendarProvider)
    ? (provider as CalendarProvider)
    : null;
}

function readString(
  value: unknown,
  field: string,
  details: Record<string, string>,
  maxLength: number
) {
  if (typeof value !== "string") {
    details[field] = "Expected a string.";
    return "";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    details[field] = "Required.";
    return "";
  }

  if (trimmed.length > maxLength) {
    details[field] = `Expected ${maxLength} characters or fewer.`;
    return "";
  }

  return trimmed;
}

function readOptionalStringArray(
  value: unknown,
  field: string,
  details: Record<string, string>
) {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    details[field] = "Expected an array of strings.";
    return [];
  }

  const ids = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  if (ids.length !== value.length) {
    details[field] = "Expected an array of strings.";
  }

  return ids;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
