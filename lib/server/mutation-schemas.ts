import { z } from "zod";
import { TRIP_TRAVEL_STYLES } from "@/lib/trips";

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

const nullableTrimmedStringSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  return value;
}, z.string().trim().transform((value) => value || null).nullable());

const nullableCoordinateSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}, z.coerce.number().finite().nullable());

const destinationProviderMetadataSchema = z
  .record(z.string(), z.unknown())
  .nullable()
  .optional()
  .transform((value) => value ?? {});

export const routeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9_-]+$/, "Use only letters, numbers, underscores, and dashes.");

export const tripMutationPayloadSchema = z
  .object({
    budget: z.coerce.number().finite().nonnegative().optional().default(0),
    destination: z.string().trim().min(1, "Trip destination is required."),
    destination_formatted_address: nullableTrimmedStringSchema.optional().default(null),
    destination_lat: nullableCoordinateSchema.optional().default(null),
    destination_lng: nullableCoordinateSchema.optional().default(null),
    destination_place_id: nullableTrimmedStringSchema.optional().default(null),
    destination_provider_metadata: destinationProviderMetadataSchema,
    destination_status: z
      .enum(["manual", "resolved", "unresolved"])
      .nullable()
      .optional()
      .default("manual"),
    documents: z.array(z.unknown()).optional().default([]),
    end_date: nullableDateSchema.optional().default(null),
    itinerary: z.array(z.unknown()).optional().default([]),
    name: z.string().trim().min(1, "Trip name is required."),
    notes: nullableTrimmedStringSchema.optional().default(null),
    route: nullableTrimmedStringSchema.optional().default(null),
    start_date: nullableDateSchema.optional().default(null),
    status: z.string().trim().min(1).optional().default("Planning"),
    travel_style: z.enum(TRIP_TRAVEL_STYLES).nullable().optional(),
    travelStyle: z.enum(TRIP_TRAVEL_STYLES).nullable().optional()
  })
  .strict()
  .transform((value) => ({
    ...value,
    travel_style: value.travel_style ?? value.travelStyle ?? "balanced"
  }));

export const adminJobsPayloadSchema = z
  .object({
    action: z.enum(["status", "run"]).optional().default("status")
  })
  .strict();

export const adminSyncPayloadSchema = z
  .object({
    action: z.enum(["health", "logs"]).optional().default("health")
  })
  .strict();

export function parseMutationPayload<T>(
  schema: z.ZodType<T>,
  value: unknown
): { ok: true; value: T } | { error: string; ok: false } {
  const result = schema.safeParse(value);
  if (!result.success) {
    return { error: formatZodError(result.error), ok: false };
  }

  return { ok: true, value: result.data };
}

export function parseRouteId(
  value: unknown,
  label = "Route id"
): { ok: true; value: string } | { error: string; ok: false } {
  const result = routeIdSchema.safeParse(value);
  if (!result.success) {
    return { error: `${label} is invalid.`, ok: false };
  }

  return { ok: true, value: result.data };
}

function formatZodError(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return "Request payload is invalid.";

  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
