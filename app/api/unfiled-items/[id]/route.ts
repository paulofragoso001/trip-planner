import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import {
  deleteUnfiledItem,
  updateUnfiledItem,
  type UnfiledItemsClient
} from "@/lib/server/unfiled-items";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";
import { validateUpdateUnfiledItem } from "@/lib/validators/unfiled-items";

const routeName = "unfiled-items/:id";

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
      return validationFailure("Unfiled item id is required.");
    }

    const validation = validateUpdateUnfiledItem(await readJson(request));

    if (!validation.ok) {
      return validationFailure("Invalid unfiled item payload.", validation.details);
    }

    const auth = await authorizeDashboardApi<UnfiledItemsClient>();

    if (!auth) {
      return unauthorized();
    }

    const item = await updateUnfiledItem(
      auth.supabase,
      auth.userId,
      id,
      validation.value
    );

    return apiCanonicalSuccess({ item });
  } catch (error) {
    return handleApiError(error, routeName);
  }
}

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
      return validationFailure("Unfiled item id is required.");
    }

    const auth = await authorizeDashboardApi<UnfiledItemsClient>();

    if (!auth) {
      return unauthorized();
    }

    await deleteUnfiledItem(auth.supabase, auth.userId, id);

    return apiCanonicalSuccess({ deleted: true });
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
