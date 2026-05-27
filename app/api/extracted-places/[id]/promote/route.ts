import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { promoteExtractedPlace } from "@/lib/server/social-imports";

const routeName = "extracted-places/:id/promote";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await readJson(request);
    const tripId = isRecord(body) && typeof body.tripId === "string" ? body.tripId.trim() : "";

    if (!id.trim()) {
      return validationFailure("Extracted place id is required.");
    }

    if (!tripId) {
      return validationFailure("tripId is required.");
    }

    const auth = await authorizeDashboardApi();

    if (!auth) {
      return unauthorized();
    }

    const result = await promoteExtractedPlace(auth.supabase, auth.userId, id, tripId);
    return apiCanonicalSuccess(result, { status: 201 });
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
