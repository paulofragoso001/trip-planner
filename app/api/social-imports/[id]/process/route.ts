import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";
import { processSocialImport } from "@/lib/server/social-imports";

const routeName = "social-imports/:id/process";

export async function POST(
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
      return validationFailure("Social import id is required.");
    }

    const auth = await authorizeDashboardApi();

    if (!auth) {
      return unauthorized();
    }

    const result = await processSocialImport(auth.supabase, auth.userId, id);
    return apiCanonicalSuccess(result);
  } catch (error) {
    return handleApiError(error, routeName);
  }
}
