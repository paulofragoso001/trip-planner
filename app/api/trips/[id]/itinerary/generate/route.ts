import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { generateSimpleTripItinerary } from "@/lib/server/itinerary-generator";

const routeName = "trips/:tripId/itinerary/generate";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;

    if (!tripId.trim()) {
      return validationFailure("tripId is required.");
    }

    const auth = await authorizeDashboardApi();

    if (!auth) {
      return unauthorized();
    }

    const itinerary = await generateSimpleTripItinerary(
      auth.supabase as any,
      auth.userId,
      tripId
    );

    return apiCanonicalSuccess({ itinerary });
  } catch (error) {
    return handleApiError(error, routeName);
  }
}
