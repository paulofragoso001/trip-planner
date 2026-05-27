import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { getSocialImportDetail } from "@/lib/server/social-imports";

const routeName = "social-imports/:id";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id.trim()) {
      return validationFailure("Social import id is required.");
    }

    const auth = await authorizeDashboardApi();

    if (!auth) {
      return unauthorized();
    }

    const detail = await getSocialImportDetail(auth.supabase, auth.userId, id);
    return apiCanonicalSuccess(detail);
  } catch (error) {
    return handleApiError(error, routeName);
  }
}
