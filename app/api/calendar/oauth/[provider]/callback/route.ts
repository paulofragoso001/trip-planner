import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { NextResponse } from "next/server";
import { exchangeAndStoreCalendarConnection } from "@/lib/server/calendar-oauth";
import { recordCalendarOAuthEvent } from "@/lib/server/calendar-oauth-events";
import { validateCalendarOAuthState } from "@/lib/server/calendar-oauth-state";
import { hasCalendarTokenEncryptionKey } from "@/lib/server/calendar-token-encryption";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeCalendarProvider } from "@/lib/validators/calendar-sync";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: providerParam } = await params;
    const provider = normalizeCalendarProvider(providerParam);

    if (!provider) {
      return validationFailure("Unsupported calendar provider.", {
        provider: "Expected google or outlook."
      });
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const state = validateCalendarOAuthState(
      url.searchParams.get("state"),
      request.headers.get("cookie")
    );

    if (!state.valid) {
      const eventType =
        state.reason === "missing_state_cookie" || state.reason === "missing_state"
          ? "oauth_missing_state_cookie"
          : "oauth_state_mismatch";

      await recordCalendarOAuthEvent({
        errorCode: state.reason,
        errorMessage: "Calendar OAuth state validation failed.",
        eventType,
        provider,
        requestPath: url.pathname
      });

      return validationFailure("Calendar OAuth state validation failed.", {
        provider,
        reason: state.reason
      });
    }

    if (error) {
      await recordCalendarOAuthEvent({
        errorCode: error,
        errorMessage: "Calendar OAuth provider returned an error.",
        eventType: "oauth_callback_failure",
        provider,
        redirectTo: state.redirectTo,
        requestPath: url.pathname
      });

      return validationFailure("Calendar OAuth provider returned an error.", {
        provider,
        providerError: error
      });
    }

    if (!code) {
      await recordCalendarOAuthEvent({
        errorCode: "missing_code",
        errorMessage: "Calendar OAuth callback is missing a code.",
        eventType: "oauth_callback_failure",
        provider,
        redirectTo: state.redirectTo,
        requestPath: url.pathname
      });

      return validationFailure("Calendar OAuth callback is missing a code.", {
        provider
      });
    }

    if (isTestCallbackBypass(request, code)) {
      const response = redirectToOAuthReturn(request, state.redirectTo, provider);
      response.headers.append("Set-Cookie", state.clearCookie);

      await recordCalendarOAuthEvent({
        eventType: "oauth_callback_success",
        metadata: { testMode: true },
        provider,
        redirectTo: state.redirectTo,
        requestPath: url.pathname
      });

      return response;
    }

    const admin = createAdminClient();
    if (!admin || !hasCalendarTokenEncryptionKey()) {
      await recordCalendarOAuthEvent({
        errorCode: "missing_server_env",
        errorMessage:
          "Configure SUPABASE_SERVICE_ROLE_KEY and CALENDAR_TOKEN_ENCRYPTION_KEY to store encrypted provider tokens.",
        eventType: "oauth_callback_failure",
        provider,
        redirectTo: state.redirectTo,
        requestPath: url.pathname
      });

      return apiCanonicalSuccess(
        {
          configured: false,
          message:
            "Calendar OAuth callback reached. Configure SUPABASE_SERVICE_ROLE_KEY and CALENDAR_TOKEN_ENCRYPTION_KEY to store encrypted provider tokens.",
          provider,
          requiredEnv: ["SUPABASE_SERVICE_ROLE_KEY", "CALENDAR_TOKEN_ENCRYPTION_KEY"]
        },
        { status: 501 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      await recordCalendarOAuthEvent({
        errorCode: "unauthorized",
        errorMessage: "Unauthorized",
        eventType: "oauth_callback_failure",
        provider,
        redirectTo: state.redirectTo,
        requestPath: url.pathname
      });

      return unauthorized();
    }

    try {
      const connection = await exchangeAndStoreCalendarConnection({
        code,
        provider,
        supabase: admin,
        userId: user.id
      });

      await recordCalendarOAuthEvent({
        connectionId: connection.id,
        eventType: "oauth_callback_success",
        provider,
        redirectTo: state.redirectTo,
        requestPath: url.pathname,
        userId: user.id
      });
    } catch (exchangeError) {
      await recordCalendarOAuthEvent({
        errorCode: "token_exchange_error",
        errorMessage:
          exchangeError instanceof Error
            ? exchangeError.message
            : "Calendar OAuth token exchange failed.",
        eventType: "oauth_token_exchange_error",
        provider,
        redirectTo: state.redirectTo,
        requestPath: url.pathname,
        userId: user.id
      });

      throw exchangeError;
    }

    const response = redirectToOAuthReturn(request, state.redirectTo, provider);
    response.headers.append("Set-Cookie", state.clearCookie);

    return response;
  } catch (error) {
    return handleApiError(error, "calendar/oauth/callback");
  }
}

function isTestCallbackBypass(request: Request, code: string) {
  return (
    process.env.NODE_ENV !== "production" &&
    request.headers.get("x-cypress-dashboard") === "true" &&
    code === "__wayline_oauth_test_code__"
  );
}

function redirectToOAuthReturn(
  request: Request,
  redirectTo: string,
  provider: "google" | "outlook"
) {
  const redirectUrl = new URL(redirectTo, request.url);
  redirectUrl.searchParams.set("calendarProvider", provider);
  redirectUrl.searchParams.set("calendarStatus", "connected");

  return NextResponse.redirect(redirectUrl);
}
