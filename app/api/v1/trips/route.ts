import { NextResponse } from "next/server";
import { z } from "zod";
import { slugify } from "@/lib/slug";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";
import { parseMutationPayload } from "@/lib/server/mutation-schemas";
import {
  isMissingTripDestinationMetadataColumn,
  mapTripRecord,
  normalizeTripInput,
  stripTripDestinationMetadata,
  toTripWritePayload,
  TRIP_TRAVEL_STYLES
} from "@/lib/trips";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Use a valid calendar date.");

const nullableDateSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}, dateOnlySchema.nullable());

const nullableBudgetSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}, z.coerce.number().finite().nonnegative().nullable());

const createTripV1PayloadSchema = z
  .object({
    destination: z.string().trim().min(1, "Destination is required."),
    end_date: nullableDateSchema.optional().default(null),
    expense_budget: nullableBudgetSchema.optional().default(null),
    start_date: nullableDateSchema.optional().default(null),
    travel_style: z.enum(TRIP_TRAVEL_STYLES).optional().default("balanced"),
    trip_name: z.string().trim().min(1, "Trip name is required.")
  })
  .strict();

export async function POST(request: Request) {
  const csrfError = validateSessionMutationRequest(request);
  if (csrfError) {
    return csrfError;
  }

  const auth = await authorizeDashboardApi();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonObject(request);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 });
  }

  const payload = parseMutationPayload(createTripV1PayloadSchema, body.value);
  if (!payload.ok) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }

  const trip = normalizeTripInput({
    budget: payload.value.expense_budget ?? 0,
    destination: payload.value.destination,
    destination_status: "manual",
    end_date: payload.value.end_date,
    name: payload.value.trip_name,
    start_date: payload.value.start_date,
    travel_style: payload.value.travel_style
  });
  const writePayload = {
    ...toTripWritePayload(trip),
    slug: `${slugify(payload.value.trip_name)}-${Date.now()}`,
    user_id: auth.userId
  };
  let { data, error } = await auth.supabase
    .from("trips")
    .insert(writePayload)
    .select("*")
    .single();

  if (
    error &&
    (isMissingTravelStyleColumn(error.message) ||
      isMissingTripDestinationMetadataColumn(error.message))
  ) {
    const { travel_style: _travelStyle, ...withoutTravelStyle } = writePayload;
    const legacyPayload = stripTripDestinationMetadata(withoutTravelStyle);
    const retry = await auth.supabase
      .from("trips")
      .insert(legacyPayload)
      .select("*")
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { trip: mapTripRecord(data as Record<string, unknown>) },
    { status: 201 }
  );
}

function isMissingTravelStyleColumn(message: string) {
  return /travel_style/i.test(message) && /column|schema cache|could not find/i.test(message);
}

async function readJsonObject(request: Request) {
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { error: "Request body must be a JSON object.", ok: false as const };
    }

    return { ok: true as const, value: value as Record<string, unknown> };
  } catch {
    return { error: "Request body must be valid JSON.", ok: false as const };
  }
}
