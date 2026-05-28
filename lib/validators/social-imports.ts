export type SocialImportSourcePlatform =
  | "instagram"
  | "manual"
  | "other"
  | "pinterest"
  | "screenshot"
  | "tiktok"
  | "youtube";

export type CreateSocialImportInput = {
  processNow: boolean;
  rawText: string | null;
  sourceCaption: string | null;
  sourcePlatform: SocialImportSourcePlatform;
  sourceTitle: string | null;
  sourceUrl: string | null;
  tripId: string | null;
};

export type UpdateExtractedPlaceInput = {
  category?: string;
  confirmDestinationMismatch?: boolean;
  name?: string;
  priority?: "candidate" | "must_do" | "optional" | "want_to_do";
  status?: "accepted" | "dismissed" | "merged" | "needs_location_confirmation" | "needs_review" | "promoted";
  travelNote?: string | null;
  tripId?: string | null;
};

export type MergeExtractedPlaceInput = {
  targetPlaceId: string;
};

type ValidationResult<TValue> =
  | { ok: true; value: TValue }
  | { details: Record<string, string>; ok: false };

const sourcePlatforms = new Set<SocialImportSourcePlatform>([
  "instagram",
  "manual",
  "other",
  "pinterest",
  "screenshot",
  "tiktok",
  "youtube"
]);

const priorities = new Set(["candidate", "must_do", "optional", "want_to_do"]);
const statuses = new Set([
  "accepted",
  "dismissed",
  "merged",
  "needs_location_confirmation",
  "needs_review",
  "promoted"
]);

export function validateCreateSocialImport(
  value: unknown
): ValidationResult<CreateSocialImportInput> {
  if (!isRecord(value)) {
    return { details: { body: "Expected a JSON object." }, ok: false };
  }

  const details: Record<string, string> = {};
  const sourceUrl = readNullableString(value.sourceUrl ?? value.source_url, 2000);
  const rawText = readNullableString(value.rawText ?? value.raw_text, 10000);
  const sourceCaption = readNullableString(
    value.sourceCaption ?? value.source_caption,
    10000
  );
  const sourceTitle = readNullableString(value.sourceTitle ?? value.source_title, 500);
  const tripId = readNullableString(value.tripId ?? value.trip_id, 120);
  const hasFile = value.hasFile === true || value.hasFile === "true";
  const sourcePlatform = normalizeSourcePlatform(
    readNullableString(value.sourcePlatform ?? value.source_platform, 40),
    sourceUrl
  );

  if (!hasFile && !sourceUrl && !rawText && !sourceCaption && !sourceTitle) {
    details.body = "Paste a URL, caption, or text to import.";
  }

  if (sourceUrl && !isSafeHttpUrl(sourceUrl)) {
    details.sourceUrl = "Expected an http or https URL.";
  }

  return Object.keys(details).length
    ? { details, ok: false }
    : {
        ok: true,
        value: {
          processNow: value.processNow === true || value.processNow === "true",
          rawText,
          sourceCaption,
          sourcePlatform,
          sourceTitle,
          sourceUrl,
          tripId
        }
      };
}

export function validateUpdateExtractedPlace(
  value: unknown
): ValidationResult<UpdateExtractedPlaceInput> {
  if (!isRecord(value)) {
    return { details: { body: "Expected a JSON object." }, ok: false };
  }

  const details: Record<string, string> = {};
  const update: UpdateExtractedPlaceInput = {};

  if ("name" in value) {
    const name = readNullableString(value.name, 300);
    if (!name) details.name = "name is required.";
    else update.name = name;
  }

  if ("category" in value) {
    update.category = readNullableString(value.category, 80) || "activity";
  }

  if ("confirmDestinationMismatch" in value || "confirm_destination_mismatch" in value) {
    update.confirmDestinationMismatch =
      value.confirmDestinationMismatch === true || value.confirm_destination_mismatch === true;
  }

  if ("travelNote" in value || "travel_note" in value) {
    update.travelNote = readNullableString(value.travelNote ?? value.travel_note, 2000);
  }

  if ("tripId" in value || "trip_id" in value) {
    update.tripId = readNullableString(value.tripId ?? value.trip_id, 120);
  }

  if ("priority" in value) {
    const priority = readNullableString(value.priority, 40);
    if (!priority || !priorities.has(priority)) {
      details.priority = "Invalid priority.";
    } else {
      update.priority = priority as UpdateExtractedPlaceInput["priority"];
    }
  }

  if ("status" in value) {
    const status = readNullableString(value.status, 40);
    if (!status || !statuses.has(status)) {
      details.status = "Invalid status.";
    } else {
      update.status = status as UpdateExtractedPlaceInput["status"];
    }
  }

  return Object.keys(details).length
    ? { details, ok: false }
    : { ok: true, value: update };
}

export function validateMergeExtractedPlace(
  value: unknown
): ValidationResult<MergeExtractedPlaceInput> {
  if (!isRecord(value)) {
    return { details: { body: "Expected a JSON object." }, ok: false };
  }

  const targetPlaceId = readNullableString(
    value.targetPlaceId ?? value.target_place_id,
    120
  );

  if (!targetPlaceId) {
    return {
      details: { targetPlaceId: "Choose a duplicate target." },
      ok: false
    };
  }

  return {
    ok: true,
    value: { targetPlaceId }
  };
}

export function normalizeSourcePlatform(
  value: string | null,
  sourceUrl?: string | null
): SocialImportSourcePlatform {
  if (value && sourcePlatforms.has(value as SocialImportSourcePlatform)) {
    return value as SocialImportSourcePlatform;
  }

  const hostname = safeHostname(sourceUrl);
  if (hostname.includes("instagram.com")) return "instagram";
  if (hostname.includes("tiktok.com")) return "tiktok";
  if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return "youtube";
  if (hostname.includes("pinterest.")) return "pinterest";
  return sourceUrl ? "other" : "manual";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNullableString(value: unknown, maxLength: number) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function safeHostname(value?: string | null) {
  if (!value) return "";
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}
