import {
  ApiError,
  apiCanonicalSuccess,
  handleApiError,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCalendarProvider } from "@/lib/validators/calendar-sync";

const connectionSelect =
  "id,provider,provider_account_email,provider_account_name,status,default_calendar_id,default_calendar_name,scopes,last_synced_at,last_error,created_at,updated_at";

export async function GET() {
  try {
    const { supabase, userId } = await authorizeCalendarConnectionRead();

    const { data, error } = await supabase
      .from("calendar_connections")
      .select(connectionSelect)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return apiCanonicalSuccess({ connections: data || [] });
  } catch (error) {
    return handleApiError(error, "calendar/connections");
  }
}

export async function DELETE(request: Request) {
  try {
    const { admin, userId } = await authorizeCalendarConnectionRequest();
    const body = await readJson(request);
    const provider = normalizeCalendarProvider(body?.provider);

    if (!provider) {
      return validationFailure("Unsupported calendar provider.", {
        provider: "Expected google or outlook."
      });
    }

    const { data, error } = await admin
      .from("calendar_connections")
      .update({
        last_error: null,
        status: "revoked"
      })
      .eq("user_id", userId)
      .eq("provider", provider)
      .select("id,provider,status")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.id) {
      await admin
        .from("calendar_connection_tokens")
        .update({
          is_current: false,
          revoked_at: new Date().toISOString()
        })
        .eq("connection_id", data.id)
        .eq("is_current", true);
    }

    return apiCanonicalSuccess({
      connection: data,
      message: `${provider === "google" ? "Google" : "Outlook"} Calendar disconnected.`
    });
  } catch (error) {
    return handleApiError(error, "calendar/connections");
  }
}

async function authorizeCalendarConnectionRead() {
  const auth = await authorizeDashboardApi();

  if (!auth) {
    throw new ApiError("unauthorized", "Unauthorized", 401);
  }

  return { supabase: auth.supabase, userId: auth.userId };
}

async function authorizeCalendarConnectionRequest() {
  const admin = createAdminClient();
  if (!admin) {
    throw new ApiError(
      "not_implemented",
      "SUPABASE_SERVICE_ROLE_KEY is not configured.",
      501
    );
  }

  const auth = await authorizeDashboardApi();

  if (!auth) {
    throw new ApiError("unauthorized", "Unauthorized", 401);
  }

  return { admin, userId: auth.userId };
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
