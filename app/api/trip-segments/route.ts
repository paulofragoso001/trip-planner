import {
  apiCanonicalSuccess,
  apiFailure,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import {
  createTripSegment,
  listTripSegments,
  type TripSegmentsClient
} from "@/lib/server/trip-segments";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import {
  validateTripSegmentWrite,
  validateTripSegmentsQuery
} from "@/lib/validators/trip-segments";

const routeName = "trip-segments";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const validation = validateTripSegmentsQuery(searchParams);

    if (!validation.ok) {
      return validationFailure("Invalid trip segments query.", validation.details);
    }

    const auth = await authorizeDashboardApi<TripSegmentsClient>();

    if (!auth) {
      return unauthorized();
    }

    const segments = await listTripSegments(
      auth.supabase,
      auth.userId,
      validation.value.tripId
    );

    return apiCanonicalSuccess({ segments });
  } catch (error) {
    return handleLegacyArrayError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const validation = validateTripSegmentWrite(await readJson(request), searchParams);

    if (!validation.ok) {
      return validationFailure("Invalid trip segment payload.", validation.details);
    }

    const auth = await authorizeDashboardApi<TripSegmentsClient>();

    if (!auth) {
      return unauthorized();
    }

    const segment = await createTripSegment(
      auth.supabase,
      auth.userId,
      validation.value
    );

    return apiCanonicalSuccess({ segment }, { status: 201 });
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

function handleLegacyArrayError(error: unknown) {
  const response = handleApiError(error, routeName);

  return response.status === 500
    ? apiFailure("internal_error", "Could not load trip segments.", 500)
    : response;
}
