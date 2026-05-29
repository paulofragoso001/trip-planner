import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { retryTripSegmentLocation } from "@/lib/server/trip-segment-location-resolution";

const routeName = "trip-segments/:id/retry-location";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id.trim()) return validationFailure("Trip stop id is required.");

    const auth = await authorizeDashboardApi();
    if (!auth) return unauthorized();

    const body = await readJson(request);
    const result = await retryTripSegmentLocation(auth.supabase as any, auth.userId, id, {
      force: Boolean(body?.force)
    });

    return apiCanonicalSuccess(result);
  } catch (error) {
    return handleApiError(error, routeName);
  }
}

async function readJson(request: Request) {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}
