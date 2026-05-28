import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { saveTripRecommendation } from "@/lib/server/travel-recommendations";

const routeName = "trip-recommendations/:id/save";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id.trim()) return validationFailure("Recommendation id is required.");

    const auth = await authorizeDashboardApi();
    if (!auth) return unauthorized();

    const result = await saveTripRecommendation(auth.supabase as any, auth.userId, id);
    return apiCanonicalSuccess(result);
  } catch (error) {
    return handleApiError(error, routeName);
  }
}
