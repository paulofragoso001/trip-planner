#!/usr/bin/env node

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SOCIAL_IMPORT_WORKER_SECRET",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL"
];

const calendarRequiredEnv = [
  "CALENDAR_TOKEN_ENCRYPTION_KEY",
  "CALENDAR_TOKEN_KEY_ID",
  "CALENDAR_SYNC_WORKER_SECRET",
  "GOOGLE_CALENDAR_CLIENT_ID",
  "GOOGLE_CALENDAR_CLIENT_SECRET",
  "GOOGLE_CALENDAR_REDIRECT_URI",
  "MICROSOFT_CALENDAR_CLIENT_ID",
  "MICROSOFT_CALENDAR_CLIENT_SECRET",
  "MICROSOFT_CALENDAR_REDIRECT_URI",
  "MICROSOFT_CALENDAR_TENANT_ID"
];

const serverSecrets = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CALENDAR_TOKEN_ENCRYPTION_KEY",
  "GOOGLE_CALENDAR_CLIENT_SECRET",
  "MICROSOFT_CALENDAR_CLIENT_SECRET",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "SOCIAL_IMPORT_WORKER_SECRET"
];

const bypassFlags = [
  "ALLOW_LOCAL_DASHBOARD_BYPASS",
  "ALLOW_TEST_DASHBOARD_BYPASS"
];

const calendarCallbackPaths = {
  google: "/api/calendar/oauth/google/callback",
  outlook: "/api/calendar/oauth/outlook/callback"
};

function main() {
  const errors = [
    ...findEnabledBypassFlags(),
    ...findMissingRequiredEnv(),
    ...findMissingProviderEnv(),
    ...findInvalidProductionUrls(),
    ...findPlaceholderPublicMapsKey(),
    ...findPublicSecretLeaks()
  ];

  if (errors.length > 0) {
    console.error("Production env preflight failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Production env preflight passed.");
}

function findEnabledBypassFlags() {
  return bypassFlags
    .filter((name) => bool(process.env[name]))
    .map((name) => `${name} must be unset or false in production.`);
}

function findMissingRequiredEnv() {
  const names = calendarEnabled()
    ? [...requiredEnv, ...calendarRequiredEnv]
    : requiredEnv;
  return names
    .filter((name) => !process.env[name])
    .map((name) => `Missing required env var: ${name}`);
}

function findMissingProviderEnv() {
  if (process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY) {
    return [];
  }

  return ["Missing required env var: GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY"];
}

function findInvalidProductionUrls() {
  const errors = [];
  const appUrl = readHttpsUrl("NEXT_PUBLIC_APP_URL", errors);
  if (!calendarEnabled()) {
    return errors;
  }
  const googleRedirect = readHttpsUrl("GOOGLE_CALENDAR_REDIRECT_URI", errors);
  const microsoftRedirect = readHttpsUrl("MICROSOFT_CALENDAR_REDIRECT_URI", errors);

  if ((process.env.CALENDAR_TOKEN_ENCRYPTION_KEY?.length ?? 0) < 32) {
    errors.push("CALENDAR_TOKEN_ENCRYPTION_KEY must be at least 32 characters.");
  }

  if (appUrl) {
    if (googleRedirect) {
      assertCallbackUrl(appUrl, googleRedirect, calendarCallbackPaths.google, errors);
    }
    if (microsoftRedirect) {
      assertCallbackUrl(
        appUrl,
        microsoftRedirect,
        calendarCallbackPaths.outlook,
        errors
      );
    }
  }

  return errors;
}

function readHttpsUrl(name, errors) {
  const rawValue = process.env[name];
  if (!rawValue) {
    return null;
  }

  try {
    const url = new URL(rawValue);
    if (url.protocol !== "https:") {
      errors.push(`${name} must use https in production.`);
    }
    return url;
  } catch {
    errors.push(`${name} must be a valid URL.`);
    return null;
  }
}

function assertCallbackUrl(appUrl, callbackUrl, expectedPath, errors) {
  if (
    callbackUrl.origin !== appUrl.origin ||
    callbackUrl.pathname !== expectedPath ||
    callbackUrl.search ||
    callbackUrl.hash
  ) {
    errors.push(
      `${callbackUrl.href} must match ${appUrl.origin}${expectedPath} and be registered in the provider console.`
    );
  }
}

function findPlaceholderPublicMapsKey() {
  const value = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!value) {
    return [];
  }

  if (/^(your-|replace-|YOUR_)/i.test(value)) {
    return ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY must be a real restricted browser key."];
  }

  return [];
}

function findPublicSecretLeaks() {
  const publicEntries = Object.entries(process.env).filter(
    ([name, value]) => name.startsWith("NEXT_PUBLIC_") && Boolean(value)
  );
  const leaks = [];

  for (const secretName of serverSecrets) {
    const secretValue = process.env[secretName];
    if (!secretValue) {
      continue;
    }

    for (const [publicName, publicValue] of publicEntries) {
      if (publicValue === secretValue) {
        leaks.push(`Secret ${secretName} is exposed via ${publicName}.`);
      }
    }
  }

  return leaks;
}

function bool(value) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

function calendarEnabled() {
  return bool(process.env.CALENDAR_SYNC_ENABLED);
}

main();
