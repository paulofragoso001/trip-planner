import { z } from "zod";

export const nativeMapRouteStatusSchema = z.enum([
  "active",
  "paused",
  "completed",
  "cancelled"
]);

export const nativeMapCoordinateSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  name: z.string().trim().min(1).optional()
}).strict();

export const nativeMapSyncPayloadSchema = z.object({
  revisionId: z.number().int().nonnegative().safe(),
  routeId: z.string().trim().min(1),
  status: nativeMapRouteStatusSchema,
  trip: z.object({
    tripId: z.string().trim().min(1),
    origin: nativeMapCoordinateSchema.required({ name: true }),
    destination: nativeMapCoordinateSchema.required({ name: true })
  }).strict(),
  wallet: z.object({
    passId: z.string().trim().min(1),
    isPassInstalled: z.boolean(),
    balance: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
    currency: z.string().regex(/^[A-Z]{3}$/)
  }).strict(),
  camera: z.object({
    center: nativeMapCoordinateSchema.omit({ name: true }),
    altitude: z.number().finite().nonnegative(),
    pitch: z.number().finite().min(0).max(180),
    heading: z.number().finite().min(0).max(360)
  }).strict()
}).strict();

export type NativeMapRouteStatus = z.infer<typeof nativeMapRouteStatusSchema>;
export type NativeMapCoordinate = z.infer<typeof nativeMapCoordinateSchema>;
export type NativeMapSyncPayload = z.infer<typeof nativeMapSyncPayloadSchema>;

export function parseNativeMapSyncPayload(value: unknown): NativeMapSyncPayload {
  return nativeMapSyncPayloadSchema.parse(value);
}

export function shouldApplyNativeMapSyncPayload(
  incomingRevisionId: number,
  latestRevisionId: number | null
) {
  return latestRevisionId === null || incomingRevisionId > latestRevisionId;
}

export class NativeMapRevisionGate {
  private latestRevisionId: number | null = null;

  get revisionId() {
    return this.latestRevisionId;
  }

  accept(payload: NativeMapSyncPayload) {
    if (!shouldApplyNativeMapSyncPayload(payload.revisionId, this.latestRevisionId)) {
      return false;
    }

    this.latestRevisionId = payload.revisionId;
    return true;
  }
}
