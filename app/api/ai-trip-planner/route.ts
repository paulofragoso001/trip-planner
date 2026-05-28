import {
  ApiError,
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { createSocialImport } from "@/lib/server/social-imports";
import {
  buildAiTripPlannerBrief,
  validateAiTripPlannerInput
} from "@/lib/validators/ai-trip-planner";

const routeName = "ai-trip-planner";

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new ApiError(
        "not_implemented",
        "OPENAI_API_KEY is not configured for the AI trip planner.",
        501
      );
    }

    const validation = validateAiTripPlannerInput(await readJson(request));
    if (!validation.ok) {
      return validationFailure("Invalid AI trip planner payload.", validation.details);
    }

    const auth = await authorizeDashboardApi();
    if (!auth) {
      return unauthorized();
    }

    const result = await createSocialImport(auth.supabase, auth.userId, {
      processNow: true,
      rawText: buildAiTripPlannerBrief(validation.value),
      sourceCaption: null,
      sourcePlatform: "manual",
      sourceTitle: validation.value.destination
        ? `Travel ideas for ${validation.value.destination}`
        : validation.value.tripName || null,
      sourceUrl: null,
      tripId: validation.value.tripId
    });

    return apiCanonicalSuccess(
      {
        extractedPlaces: result.extractedPlaces,
        provider: "openai",
        socialImport: result.socialImport
      },
      { status: 201 }
    );
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
