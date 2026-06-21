import {
  ApiError,
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";

const routeName = "budget-records/:id";

export async function DELETE(
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
      return validationFailure("Budget record id is required.");
    }

    const auth = await authorizeDashboardApi();

    if (!auth) {
      return unauthorized();
    }

    const { error } = await auth.supabase
      .from("budget_records")
      .delete()
      .eq("id", id)
      .eq("user_id", auth.userId);

    if (error) {
      throw new ApiError("internal_error", "Could not delete budget record.", 500, {
        supabaseMessage: error.message
      });
    }

    return apiCanonicalSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, routeName);
  }
}
