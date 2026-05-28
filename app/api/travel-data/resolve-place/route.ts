import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { resolvePlace } from "@/lib/travel-data";
import { validateResolvePlaceInput } from "@/lib/validators/travel-data";

const routeName = "travel-data/resolve-place";

export async function POST(request: Request) {
  try {
    const validation = validateResolvePlaceInput(await readJson(request));
    if (!validation.ok) {
      return validationFailure("Invalid place resolution payload.", validation.details);
    }

    const auth = await authorizeDashboardApi();
    if (!auth) return unauthorized();

    const resolved = await resolvePlace(validation.value);
    return apiCanonicalSuccess({ resolved });
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
