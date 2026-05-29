import "server-only";

const productionRequiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CALENDAR_TOKEN_ENCRYPTION_KEY",
  "CALENDAR_SYNC_WORKER_SECRET",
  "SOCIAL_IMPORT_WORKER_SECRET",
  "GOOGLE_CALENDAR_CLIENT_ID",
  "GOOGLE_CALENDAR_CLIENT_SECRET",
  "GOOGLE_CALENDAR_REDIRECT_URI",
  "MICROSOFT_CALENDAR_CLIENT_ID",
  "MICROSOFT_CALENDAR_CLIENT_SECRET",
  "MICROSOFT_CALENDAR_REDIRECT_URI",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL"
] as const;

const serverSecretEnv = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CALENDAR_TOKEN_ENCRYPTION_KEY",
  "GOOGLE_CALENDAR_CLIENT_SECRET",
  "MICROSOFT_CALENDAR_CLIENT_SECRET",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "SOCIAL_IMPORT_WORKER_SECRET"
] as const;

export function validateEnv() {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }

  assertProductionBypassesDisabled();

  for (const name of productionRequiredEnv) {
    requireEnv(name);
  }

  assertServerPlaceResolutionConfigured();

  for (const name of serverSecretEnv) {
    assertSecretIsNotPublic(name);
  }

  assertProductionUrls();
}

function bool(name: string) {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "true" || value === "1";
}

function requireEnv(name: string) {
  if (!process.env[name]) {
    throw new Error(`Missing required env var: ${name}`);
  }
}

function assertServerPlaceResolutionConfigured() {
  if (process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY) {
    return;
  }

  throw new Error(
    "Missing required env var: GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY"
  );
}

function assertProductionBypassesDisabled() {
  const enabledBypasses = [
    "ALLOW_LOCAL_DASHBOARD_BYPASS",
    "ALLOW_TEST_DASHBOARD_BYPASS"
  ].filter(bool);

  if (enabledBypasses.length > 0) {
    throw new Error(
      `Dashboard auth bypass flags must be disabled in production: ${enabledBypasses.join(", ")}`
    );
  }
}

function assertSecretIsNotPublic(secretName: string) {
  const secretValue = process.env[secretName];
  if (!secretValue) {
    return;
  }

  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith("NEXT_PUBLIC_") || !value) {
      continue;
    }

    if (value === secretValue) {
      throw new Error(`Secret ${secretName} is exposed via ${name}`);
    }
  }
}

function assertProductionUrls() {
  const appUrl = requireHttpsUrl("NEXT_PUBLIC_APP_URL");
  const googleRedirect = requireHttpsUrl("GOOGLE_CALENDAR_REDIRECT_URI");
  const microsoftRedirect = requireHttpsUrl("MICROSOFT_CALENDAR_REDIRECT_URI");

  assertCallbackUrl(appUrl, googleRedirect, "/api/calendar/oauth/google/callback");
  assertCallbackUrl(appUrl, microsoftRedirect, "/api/calendar/oauth/outlook/callback");
}

function requireHttpsUrl(name: string) {
  const rawValue = process.env[name];
  if (!rawValue) {
    throw new Error(`Missing required env var: ${name}`);
  }

  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  if (url.protocol !== "https:") {
    throw new Error(`${name} must use https in production.`);
  }

  return url;
}

function assertCallbackUrl(appUrl: URL, callbackUrl: URL, expectedPath: string) {
  if (callbackUrl.origin !== appUrl.origin || callbackUrl.pathname !== expectedPath) {
    throw new Error(
      `${callbackUrl.pathname} must be registered on the production app origin: ${appUrl.origin}${expectedPath}`
    );
  }
}
