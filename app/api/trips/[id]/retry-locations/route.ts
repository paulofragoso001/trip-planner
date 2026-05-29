import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { resolveUnmappedPhysicalTripSegments } from "@/lib/server/trip-segment-location-resolution";

const routeName = "trips/:tripId/retry-locations";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;
    if (!tripId.trim()) return validationFailure("Trip id is required.");

    const auth = await authorizeDashboardApi();
    if (!auth) return unauthorized();

    const { data: trip, error } = await auth.supabase
      .from("trips")
      .select("destination,name,title")
      .eq("id", tripId)
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (error || !trip) return validationFailure("Trip not found.");

    const result = await resolveUnmappedPhysicalTripSegments(
      auth.supabase as any,
      auth.userId,
      tripId,
      trip
    );

    return apiCanonicalSuccess(result);
  } catch (error) {
    return handleApiError(error, routeName);
  }
}
