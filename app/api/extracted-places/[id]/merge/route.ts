import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { mergeExtractedPlace } from "@/lib/server/social-imports";
import { validateMergeExtractedPlace } from "@/lib/validators/social-imports";

const routeName = "extracted-places/:id/merge";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id.trim()) {
      return validationFailure("Extracted place id is required.");
    }

    const validation = validateMergeExtractedPlace(await readJson(request));

    if (!validation.ok) {
      return validationFailure("Invalid merge payload.", validation.details);
    }

    const auth = await authorizeDashboardApi();

    if (!auth) {
      return unauthorized();
    }

    const result = await mergeExtractedPlace(
      auth.supabase,
      auth.userId,
      id,
      validation.value
    );

    return apiCanonicalSuccess(result);
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
