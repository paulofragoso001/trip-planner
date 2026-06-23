import { apiCanonicalSuccess, validationFailure } from "@/lib/api/errors";
import { recordCalendarOAuthEvent } from "@/lib/server/calendar-oauth-events";
import { createCalendarOAuthState, isSafeInternalPath } from "@/lib/server/calendar-oauth-state";
import { normalizeCalendarProvider } from "@/lib/validators/calendar-sync";

const googleScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events"
];
const outlookScopes = ["offline_access", "User.Read", "Calendars.ReadWrite"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = normalizeCalendarProvider(providerParam);

  if (!provider) {
    return validationFailure("Unsupported calendar provider.", {
      provider: "Expected google or outlook."
    });
  }

  const url = new URL(request.url);
  const redirectPath = url.searchParams.get("redirect") || "/dashboard";
  const safeRedirect = isSafeInternalPath(redirectPath);
  const redirectTo = safeRedirect ? redirectPath : "/dashboard";
  const state = createCalendarOAuthState(redirectTo);
  const authUrl = buildAuthorizationUrl(provider, state.encodedState);

  if (!safeRedirect) {
    await recordCalendarOAuthEvent({
      errorCode: "unsafe_redirect",
      eventType: "oauth_unsafe_redirect",
      provider,
      redirectTo: redirectPath,
      requestPath: url.pathname
    });
  }

  if (!authUrl) {
    return apiCanonicalSuccess(
      {
        authUrl: null,
        configured: false,
        message: `${provider === "google" ? "Google" : "Outlook"} Calendar OAuth is not configured.`,
        provider,
        requiredEnv:
          provider === "google"
            ? [
                "GOOGLE_CALENDAR_CLIENT_ID",
                "GOOGLE_CALENDAR_CLIENT_SECRET",
                "GOOGLE_CALENDAR_REDIRECT_URI"
              ]
            : [
                "MICROSOFT_CALENDAR_CLIENT_ID",
                "MICROSOFT_CALENDAR_CLIENT_SECRET",
                "MICROSOFT_CALENDAR_REDIRECT_URI"
              ]
      },
      { status: 501 }
    );
  }

  await recordCalendarOAuthEvent({
    eventType: "oauth_start",
    provider,
    redirectTo,
    requestPath: url.pathname
  });

  const response = wantsHtmlRedirect(request)
    ? Response.redirect(authUrl, 302)
    : apiCanonicalSuccess({
        authUrl,
        configured: true,
        provider
      });

  response.headers.append("Set-Cookie", state.cookie);

  return response;
}

function wantsHtmlRedirect(request: Request) {
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html") && !accept.includes("application/json");
}

function buildAuthorizationUrl(provider: "google" | "outlook", encodedState: string) {
  if (provider === "google") {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return null;
    }

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", googleScopes.join(" "));
    url.searchParams.set("state", encodedState);

    return url.toString();
  }

  const clientId = process.env.MICROSOFT_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CALENDAR_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_CALENDAR_REDIRECT_URI;
  const tenant = process.env.MICROSOFT_CALENDAR_TENANT_ID || "common";

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  const url = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", outlookScopes.join(" "));
  url.searchParams.set("state", encodedState);

  return url.toString();
}
