import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { generateTripRecommendations } from "@/lib/server/travel-recommendations";

const routeName = "trips/:tripId/generate-suggestions";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;
    if (!tripId.trim()) return validationFailure("tripId is required.");

    const auth = await authorizeDashboardApi();
    if (!auth) return unauthorized();

    const result = await generateTripRecommendations(auth.supabase as any, auth.userId, tripId);
    return apiCanonicalSuccess(result);
  } catch (error) {
    return handleApiError(error, routeName);
  }
}
