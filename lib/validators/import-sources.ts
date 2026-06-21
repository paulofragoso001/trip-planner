export const importSourceTypes = [
  "email_forwarding",
  "gmail",
  "outlook",
  "calendar"
] as const;

export type ImportSourceType = (typeof importSourceTypes)[number];

export type ImportSourcePatchInput = {
  connected: boolean;
  confirmDisconnect: boolean;
  lastError: string | null;
  sourceLabel: string | null;
  sourceType: ImportSourceType;
};

type ValidationResult<TValue> =
  | { ok: true; value: TValue }
  | { details: Record<string, string>; ok: false };

export function validateImportSourcePatch(value: unknown): ValidationResult<ImportSourcePatchInput> {
  if (!isRecord(value)) {
    return {
      details: { body: "Expected a JSON object." },
      ok: false
    };
  }

  const details: Record<string, string> = {};
  rejectUnknownFields(
    value,
    ["connected", "confirmDisconnect", "lastError", "sourceLabel", "sourceType"],
    details
  );
  const sourceType = normalizeSourceType(value.sourceType);

  if (!sourceType) {
    details.sourceType = "Unsupported import source.";
  }

  if (value.connected != null && typeof value.connected !== "boolean") {
    details.connected = "Expected a boolean.";
  }

  if (
    value.confirmDisconnect != null &&
    typeof value.confirmDisconnect !== "boolean"
  ) {
    details.confirmDisconnect = "Expected a boolean.";
  }

  if (value.connected === false && value.confirmDisconnect !== true) {
    details.confirmDisconnect = "Disconnecting an import source requires confirmation.";
  }

  const sourceLabel = readOptionalString(value.sourceLabel, "sourceLabel", details, 120);
  const lastError = readOptionalString(value.lastError, "lastError", details, 500);

  if (Object.keys(details).length > 0 || !sourceType) {
    return { details, ok: false };
  }

  return {
    ok: true,
    value: {
      connected: value.connected === true,
      confirmDisconnect: value.confirmDisconnect === true,
      lastError,
      sourceLabel,
      sourceType
    }
  };
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

export function normalizeSourceType(value: unknown): ImportSourceType | null {
  const sourceType = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (sourceType === "email") {
    return "email_forwarding";
  }

  return importSourceTypes.includes(sourceType as ImportSourceType)
    ? (sourceType as ImportSourceType)
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOptionalString(
  value: unknown,
  field: string,
  details: Record<string, string>,
  maxLength: number
) {
  if (value == null) {
    return null;
  }

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
