import "server-only";

import { calendarCallbackPath } from "@/lib/server/calendar-redirect-uri";
import { getCalendarEnvironmentStatus } from "@/lib/server/calendar-feature";

const productionRequiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SOCIAL_IMPORT_WORKER_SECRET",
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

  const calendar = getCalendarEnvironmentStatus();
  if (!calendar.ok) {
    throw new Error(`Missing required env var: ${calendar.missing[0]}`);
  }
  if (
    calendar.enabled &&
    (process.env.CALENDAR_TOKEN_ENCRYPTION_KEY?.length ?? 0) < 32
  ) {
    throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY must be at least 32 characters.");
  }

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
  if (!getCalendarEnvironmentStatus().enabled) {
    return;
  }
  const googleRedirect = requireHttpsUrl("GOOGLE_CALENDAR_REDIRECT_URI");
  const microsoftRedirect = requireHttpsUrl("MICROSOFT_CALENDAR_REDIRECT_URI");

  assertConfiguredCallbackUrl(
    appUrl,
    googleRedirect,
    calendarCallbackPath("google")
  );
  assertConfiguredCallbackUrl(
    appUrl,
    microsoftRedirect,
    calendarCallbackPath("outlook")
  );
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

function assertConfiguredCallbackUrl(
  appUrl: URL,
  configuredUrl: URL,
  expectedPath: string
) {
  if (
    configuredUrl.origin !== appUrl.origin ||
    configuredUrl.pathname !== expectedPath ||
    configuredUrl.search ||
    configuredUrl.hash
  ) {
    throw new Error(
      `${configuredUrl.href} must match ${appUrl.origin}${expectedPath} and be registered in the provider console.`
    );
  }
}
