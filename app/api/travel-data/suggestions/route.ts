import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { searchNearbyActivities } from "@/lib/travel-data";
import { validateSuggestionsInput } from "@/lib/validators/travel-data";

const routeName = "travel-data/suggestions";

export async function POST(request: Request) {
  try {
    const validation = validateSuggestionsInput(await readJson(request));
    if (!validation.ok) {
      return validationFailure("Invalid suggestions payload.", validation.details);
    }

    const auth = await authorizeDashboardApi();
    if (!auth) return unauthorized();

    const suggestions = await searchNearbyActivities({
      limit: validation.value.limit,
      location: {
        latitude: validation.value.latitude,
        longitude: validation.value.longitude,
        title: validation.value.title
      },
      radiusMeters: validation.value.radiusMeters,
      tripContext: { tripId: validation.value.tripId }
    });

    return apiCanonicalSuccess({ suggestions });
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
