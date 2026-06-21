import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";
import {
  promoteUnfiledItem,
  type UnfiledItemsClient
} from "@/lib/server/unfiled-items";

const routeName = "unfiled-items/:id/promote";

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
    const body = await readJson(request);
    const validation = validatePromotePayload(body, ["tripId"]);

    if (!id.trim()) {
      return validationFailure("Unfiled item id is required.");
    }

    if (!validation.ok) {
      return validationFailure("Invalid promote payload.", validation.details);
    }

    const auth = await authorizeDashboardApi<UnfiledItemsClient>();

    if (!auth) {
      return unauthorized();
    }

    const result = await promoteUnfiledItem(auth.supabase, auth.userId, id, validation.tripId);

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

function validatePromotePayload(value: unknown, allowedFields: readonly string[]) {
  if (!isRecord(value)) {
    return { details: { body: "Expected a JSON object." }, ok: false as const };
  }

  const details: Record<string, string> = {};
  const unknown = Object.keys(value).filter((key) => !allowedFields.includes(key));
  if (unknown.length) {
    details.body = `Unknown field${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`;
  }

  const tripId = typeof value.tripId === "string" ? value.tripId.trim() : "";
  if (!tripId) {
    details.tripId = "tripId is required.";
  }

  return Object.keys(details).length
    ? { details, ok: false as const }
    : { ok: true as const, tripId };
}
