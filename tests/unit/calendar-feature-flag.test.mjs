import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getCalendarEnvironmentStatus } from "../../lib/server/calendar-feature.ts";
import { areCoreHealthChecksHealthy } from "../../lib/server/health-status.ts";

const baseEnv = {
  NEXT_PUBLIC_APP_URL: "https://staging.almidy.app",
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "restricted-map-key",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  GOOGLE_PLACES_API_KEY: "restricted-places-key",
  OPENAI_API_KEY: "openai-secret",
  RESEND_API_KEY: "resend-secret",
  RESEND_FROM_EMAIL: "Almidy <staging@example.com>",
  SOCIAL_IMPORT_WORKER_SECRET: "social-secret",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-secret"
};

const completeCalendarEnv = {
  CALENDAR_SYNC_ENABLED: "true",
  CALENDAR_SYNC_WORKER_SECRET: "calendar-worker-secret",
  CALENDAR_TOKEN_ENCRYPTION_KEY: "12345678901234567890123456789012",
  CALENDAR_TOKEN_KEY_ID: "staging-v1",
  GOOGLE_CALENDAR_CLIENT_ID: "google-client",
  GOOGLE_CALENDAR_CLIENT_SECRET: "google-secret",
  GOOGLE_CALENDAR_REDIRECT_URI: "https://staging.almidy.app/api/calendar/oauth/google/callback",
  MICROSOFT_CALENDAR_CLIENT_ID: "microsoft-client",
  MICROSOFT_CALENDAR_CLIENT_SECRET: "microsoft-secret",
  MICROSOFT_CALENDAR_REDIRECT_URI: "https://staging.almidy.app/api/calendar/oauth/outlook/callback",
  MICROSOFT_CALENDAR_TENANT_ID: "common"
};

test("Calendar defaults disabled and healthy without Calendar variables", () => {
  assert.deepEqual(getCalendarEnvironmentStatus({}), {
    configured: false,
    deferred: true,
    enabled: false,
    missing: [],
    ok: true
  });
  assert.equal(runPreflight({ CALENDAR_SYNC_ENABLED: "false" }).status, 0);
  assert.equal(areCoreHealthChecksHealthy({
    calendar: getCalendarEnvironmentStatus({}),
    env: { ok: true },
    supabase: { ok: true },
    travelProviders: { ok: true }
  }), true);
});

test("disabled Calendar routes reject before provider or database work", () => {
  for (const path of [
    "app/api/calendar/connections/route.ts",
    "app/api/calendar/oauth/[provider]/route.ts",
    "app/api/calendar/oauth/[provider]/callback/route.ts",
    "app/api/calendar/sync/route.ts",
    "app/api/calendar/worker/route.ts"
  ]) {
    const source = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
    assert.match(source, /if \(!isCalendarSyncEnabled\(\)\) return calendarDisabled\(\);/);
  }
});

test("enabled Calendar fails when any required variable is missing", () => {
  const status = getCalendarEnvironmentStatus({ CALENDAR_SYNC_ENABLED: "true" });
  assert.equal(status.enabled, true);
  assert.equal(status.ok, false);
  assert.ok(status.missing.includes("GOOGLE_CALENDAR_CLIENT_ID"));
  const preflight = runPreflight({ CALENDAR_SYNC_ENABLED: "true" });
  assert.equal(preflight.status, 1);
  assert.match(preflight.stderr, /Missing required env var: GOOGLE_CALENDAR_CLIENT_ID/);
});

test("enabled Calendar passes with the complete strict contract", () => {
  assert.deepEqual(getCalendarEnvironmentStatus(completeCalendarEnv), {
    configured: true,
    deferred: false,
    enabled: true,
    missing: [],
    ok: true
  });
  assert.equal(runPreflight(completeCalendarEnv).status, 0);
});

function runPreflight(calendarEnv) {
  return spawnSync(process.execPath, ["scripts/production-env-preflight.mjs"], {
    cwd: new URL("../../", import.meta.url),
    encoding: "utf8",
    env: { PATH: process.env.PATH, ...baseEnv, ...calendarEnv }
  });
}
