const parseStatuses = ["needs_review", "ready", "promoted", "dismissed"] as const;
const segmentTypes = [
  "flight",
  "hotel",
  "car",
  "restaurant",
  "activity",
  "transport",
  "meeting",
  "note"
] as const;
const sourceTypes = ["email", "pdf", "photo", "screenshot", "manual"] as const;

export type ParseStatus = (typeof parseStatuses)[number];
export type SegmentType = (typeof segmentTypes)[number];
export type SourceType = (typeof sourceTypes)[number];

export type UnfiledItemsQuery = {
  status: ParseStatus | null;
  tripId: string | null;
};

export type CreateUnfiledItemInput = {
  dateTime: string | null;
  location: string | null;
  notes: string | null;
  rawText: string;
  segmentType: SegmentType | null;
  sourceLabel: string | null;
  sourceType: SourceType;
  title: string | null;
  tripId: string | null;
};

export type UpdateUnfiledItemInput = {
  dateTime?: string | null;
  location?: string | null;
  notes?: string | null;
  parseStatus?: ParseStatus;
  promotedTripSegmentId?: string | null;
  segmentType?: SegmentType;
  title?: string | null;
  tripId?: string | null;
};

type ValidationResult<TValue> =
  | { ok: true; value: TValue }
  | { details: Record<string, string>; ok: false };

export function validateUnfiledItemsQuery(
  searchParams: URLSearchParams
): ValidationResult<UnfiledItemsQuery> {
  const details: Record<string, string> = {};
  const status = searchParams.get("status");
  const normalizedStatus = status ? normalizeStatus(status) : null;

  if (status && !normalizedStatus) {
    details.status = "Unsupported parse status.";
  }

  return Object.keys(details).length
    ? { details, ok: false }
    : {
        ok: true,
        value: {
          status: normalizedStatus,
          tripId: readQueryString(searchParams.get("tripId"))
        }
      };
}

export function validateCreateUnfiledItem(
  value: unknown
): ValidationResult<CreateUnfiledItemInput> {
  if (!isRecord(value)) {
    return { details: { body: "Expected a JSON object." }, ok: false };
  }

  const details: Record<string, string> = {};
  rejectUnknownFields(
    value,
    [
      "dateTime",
      "location",
      "notes",
      "rawText",
      "segmentType",
      "sourceLabel",
      "sourceType",
      "title",
      "tripId"
    ],
    details
  );
  const rawText = readOptionalString(value.rawText, "rawText", details, 5000) || "";
  const title = readOptionalString(value.title, "title", details, 200);

  if (!rawText && !title) {
    details.body = "Paste confirmation text or provide a title to create an unfiled item.";
  }

  const segmentType =
    value.segmentType == null ? null : normalizeSegmentType(value.segmentType);
  const sourceType = normalizeSourceType(value.sourceType);

  if (value.segmentType != null && !segmentType) {
    details.segmentType = "Unsupported segment type.";
  }

  if (Object.keys(details).length > 0) {
    return { details, ok: false };
  }

  return {
    ok: true,
    value: {
      dateTime: readOptionalString(value.dateTime, "dateTime", details, 120),
      location: readOptionalString(value.location, "location", details, 500),
      notes: readOptionalString(value.notes, "notes", details, 5000),
      rawText,
      segmentType,
      sourceLabel: readOptionalString(value.sourceLabel, "sourceLabel", details, 120),
      sourceType,
      title,
      tripId: readOptionalString(value.tripId, "tripId", details, 120)
    }
  };
}

export function validateUpdateUnfiledItem(
  value: unknown
): ValidationResult<UpdateUnfiledItemInput> {
  if (!isRecord(value)) {
    return { details: { body: "Expected a JSON object." }, ok: false };
  }

  const details: Record<string, string> = {};
  rejectUnknownFields(
    value,
    [
      "dateTime",
      "location",
      "notes",
      "parseStatus",
      "promotedTripSegmentId",
      "segmentType",
      "title",
      "tripId"
    ],
    details
  );
  const update: UpdateUnfiledItemInput = {};

  if ("tripId" in value) update.tripId = readNullableString(value.tripId, "tripId", details, 120);
  if ("parseStatus" in value) {
    const status = normalizeStatus(value.parseStatus);
    if (!status) details.parseStatus = "Unsupported parse status.";
    else update.parseStatus = status;
  }
  if ("title" in value) update.title = readNullableString(value.title, "title", details, 200);
  if ("location" in value) {
    update.location = readNullableString(value.location, "location", details, 500);
  }
  if ("dateTime" in value) {
    update.dateTime = readNullableString(value.dateTime, "dateTime", details, 120);
  }
  if ("segmentType" in value) {
    const segmentType = normalizeSegmentType(value.segmentType);
    if (!segmentType) details.segmentType = "Unsupported segment type.";
    else update.segmentType = segmentType;
  }
  if ("notes" in value) update.notes = readNullableString(value.notes, "notes", details, 5000);
  if ("promotedTripSegmentId" in value) {
    update.promotedTripSegmentId = readNullableString(
      value.promotedTripSegmentId,
      "promotedTripSegmentId",
      details,
      120
    );
  }

  return Object.keys(details).length ? { details, ok: false } : { ok: true, value: update };
}

export function normalizeStatus(value: unknown): ParseStatus | null {
  const cleanValue = typeof value === "string" ? value.trim().toLowerCase() : "";
  return parseStatuses.includes(cleanValue as ParseStatus) ? (cleanValue as ParseStatus) : null;
}

export function normalizeSegmentType(value: unknown): SegmentType | null {
  const cleanValue = typeof value === "string" ? value.trim().toLowerCase() : "";
  return segmentTypes.includes(cleanValue as SegmentType)
    ? (cleanValue as SegmentType)
    : null;
}

export function normalizeSourceType(value: unknown): SourceType {
  const cleanValue = typeof value === "string" ? value.trim().toLowerCase() : "";
  return sourceTypes.includes(cleanValue as SourceType) ? (cleanValue as SourceType) : "manual";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readQueryString(value: string | null) {
  return value?.trim() || null;
}

function readOptionalString(
  value: unknown,
  field: string,
  details: Record<string, string>,
  maxLength: number
) {
  if (value == null) return null;
  return readNullableString(value, field, details, maxLength);
}

function readNullableString(
  value: unknown,
  field: string,
  details: Record<string, string>,
  maxLength: number
) {
  if (value == null) return null;

  if (typeof value !== "string") {
    details[field] = "Expected a string.";
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    details[field] = `Expected ${maxLength} characters or fewer.`;
    return null;
  }

  return trimmed || null;
}

function rejectUnknownFields(
  value: Record<string, unknown>,
  allowedFields: readonly string[],
  details: Record<string, string>
) {
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) {
    details.body = `Unknown field${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`;
  }
}
