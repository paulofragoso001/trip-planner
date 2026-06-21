import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import {
  listImportSources,
  upsertImportSource,
  type ImportSourcesClient
} from "@/lib/server/import-sources";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";
import { validateImportSourcePatch } from "@/lib/validators/import-sources";

const routeName = "import-sources";

export async function GET() {
  try {
    const auth = await authorizeDashboardApi<ImportSourcesClient>();

    if (!auth) {
      return unauthorized();
    }

    const sources = await listImportSources(
      auth.supabase,
      auth.userId
    );

    return apiCanonicalSuccess({ sources });
  } catch (error) {
    return handleApiError(error, routeName);
  }
}

export async function PATCH(request: Request) {
  try {
    const csrfError = validateSessionMutationRequest(request);
    if (csrfError) {
      return csrfError;
    }

    const auth = await authorizeDashboardApi<ImportSourcesClient>();

    if (!auth) {
      return unauthorized();
    }

    const validation = validateImportSourcePatch(await readJson(request));

    if (!validation.ok) {
      return validationFailure("Invalid import source payload.", validation.details);
    }

    const source = await upsertImportSource(
      auth.supabase,
      auth.userId,
      validation.value
    );

    return apiCanonicalSuccess({ source });
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
