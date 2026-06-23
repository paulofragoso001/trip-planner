import { z } from "zod";
import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import {
  geocodeAddressWithGoogle,
  reverseGeocodeWithGoogle
} from "@/lib/google/data-services";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";

const routeName = "travel-data/geocode";

const coordinateSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180)
}).strict();

const geocodeRequestSchema = z.union([
  z.object({
    address: z.string().trim().min(1).max(500)
  }).strict(),
  z.object({
    coordinate: coordinateSchema
  }).strict()
]);

export async function POST(request: Request) {
  try {
    const csrfError = validateSessionMutationRequest(request);
    if (csrfError) return csrfError;

    const validation = geocodeRequestSchema.safeParse(await readJson(request));
    if (!validation.success) {
      return validationFailure("Invalid geocode payload.", validation.error.flatten().fieldErrors);
    }

    const auth = await authorizeDashboardApi();
    if (!auth) return unauthorized();

    const result = "address" in validation.data
      ? await geocodeAddressWithGoogle(validation.data.address)
      : await reverseGeocodeWithGoogle(validation.data.coordinate);

    return apiCanonicalSuccess({ result });
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
