import {
  ApiError,
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";

const routeName = "budget-records";

export async function POST(request: Request) {
  try {
    const validation = validateBudgetRecord(await readJson(request));

    if (!validation.ok) {
      return validationFailure("Invalid budget record payload.", validation.details);
    }

    const auth = await authorizeDashboardApi();

    if (!auth) {
      return unauthorized();
    }

    const { data, error } = await auth.supabase
      .from("budget_records")
      .insert({
        amount: validation.value.amount,
        category: validation.value.category,
        currency: validation.value.currency,
        label: validation.value.label,
        notes: validation.value.notes,
        record_type: validation.value.recordType,
        segment_id: validation.value.segmentId,
        trip_id: validation.value.tripId,
        user_id: auth.userId
      })
      .select("id,trip_id,category,label,amount,currency,record_type,segment_id,notes")
      .single();

    if (error) {
      throw new ApiError("internal_error", "Could not create budget record.", 500, {
        supabaseMessage: error.message
      });
    }

    return apiCanonicalSuccess({ record: data }, { status: 201 });
  } catch (error) {
    return handleApiError(error, routeName);
  }
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function validateBudgetRecord(value: unknown) {
  if (!isRecord(value)) {
    return { details: { body: "Expected a JSON object." }, ok: false as const };
  }

  const details: Record<string, string> = {};
  const tripId = readString(value.tripId, 120);
  const label = readString(value.label, 120);
  const category = readString(value.category, 80) || "misc";
  const amount = readNumber(value.amount);
  const currency = readString(value.currency, 3) || "USD";
  const recordType = readString(value.recordType, 20) || "actual";

  if (!tripId) details.tripId = "tripId is required.";
  if (!label) details.label = "label is required.";
  if (amount == null || amount < 0) details.amount = "amount must be a non-negative number.";
  if (recordType !== "planned" && recordType !== "actual") {
    details.recordType = "recordType must be planned or actual.";
  }

  if (Object.keys(details).length || !tripId || !label || amount == null) {
    return { details, ok: false as const };
  }

  return {
    ok: true as const,
    value: {
      amount,
      category,
      currency: currency.toUpperCase(),
      label,
      notes: readNullableString(value.notes, 1000),
      recordType,
      segmentId: readNullableString(value.segmentId, 120),
      tripId
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

function readNullableString(value: unknown, maxLength: number) {
  if (value == null || value === "") return null;
  return readString(value, maxLength);
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
