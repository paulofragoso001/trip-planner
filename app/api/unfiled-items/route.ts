import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import {
  createUnfiledItem,
  listUnfiledItems,
  type UnfiledItemsClient
} from "@/lib/server/unfiled-items";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import {
  validateCreateUnfiledItem,
  validateUnfiledItemsQuery
} from "@/lib/validators/unfiled-items";

const routeName = "unfiled-items";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const validation = validateUnfiledItemsQuery(searchParams);

    if (!validation.ok) {
      return validationFailure("Invalid unfiled items query.", validation.details);
    }

    const auth = await authorizeDashboardApi<UnfiledItemsClient>();

    if (!auth) {
      return unauthorized();
    }

    const items = await listUnfiledItems(
      auth.supabase,
      auth.userId,
      validation.value
    );

    return apiCanonicalSuccess({ items });
  } catch (error) {
    return handleApiError(error, routeName);
  }
}

export async function POST(request: Request) {
  try {
    const validation = validateCreateUnfiledItem(await readJson(request));

    if (!validation.ok) {
      return validationFailure("Invalid unfiled item payload.", validation.details);
    }

    const auth = await authorizeDashboardApi<UnfiledItemsClient>();

    if (!auth) {
      return unauthorized();
    }

    const item = await createUnfiledItem(
      auth.supabase,
      auth.userId,
      validation.value
    );

    return apiCanonicalSuccess({ item }, { status: 201 });
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
