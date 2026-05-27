export function readApiField<TValue>(
  payload: unknown,
  field: string,
  fallback: TValue
): TValue {
  if (!isRecord(payload)) {
    return fallback;
  }

  const data = isRecord(payload.data) ? payload.data : null;
  return (data?.[field] ?? payload[field] ?? fallback) as TValue;
}

export function getApiErrorMessage(payload: unknown, fallback: string) {
  if (!isRecord(payload)) {
    return fallback;
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  if (isRecord(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }

  return fallback;
}

export function readLegacyArrayOrField<TValue>(
  payload: unknown,
  field: string,
  fallback: TValue[]
): TValue[] {
  if (Array.isArray(payload)) {
    return payload as TValue[];
  }

  return readApiField<TValue[]>(payload, field, fallback);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
