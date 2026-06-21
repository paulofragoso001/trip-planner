import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";
import { updateExtractedPlace } from "@/lib/server/social-imports";
import { validateUpdateExtractedPlace } from "@/lib/validators/social-imports";

const routeName = "extracted-places/:id";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = validateSessionMutationRequest(request);
    if (csrfError) {
      return csrfError;
    }

    const { id } = await params;

    if (!id.trim()) {
      return validationFailure("Extracted place id is required.");
    }

    const validation = validateUpdateExtractedPlace(await readJson(request));

    if (!validation.ok) {
      return validationFailure("Invalid extracted place payload.", validation.details);
    }

    const auth = await authorizeDashboardApi();

    if (!auth) {
      return unauthorized();
    }

    const place = await updateExtractedPlace(
      auth.supabase,
      auth.userId,
      id,
      validation.value
    );

    return apiCanonicalSuccess({ place });
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
