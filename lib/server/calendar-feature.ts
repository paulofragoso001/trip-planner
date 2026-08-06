export const calendarRequiredEnv = [
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
] as const;

type CalendarEnvironment = Record<string, string | undefined>;

export function isCalendarSyncEnabled(env: CalendarEnvironment = process.env) {
  const value = env.CALENDAR_SYNC_ENABLED?.trim().toLowerCase();
  return value === "true" || value === "1";
}

export function getCalendarEnvironmentStatus(
  env: CalendarEnvironment = process.env
) {
  if (!isCalendarSyncEnabled(env)) {
    return {
      configured: false,
      deferred: true,
      enabled: false,
      missing: [] as string[],
      ok: true
    };
  }

  const missing = calendarRequiredEnv.filter((name) => !env[name]?.trim());
  return {
    configured: missing.length === 0,
    deferred: false,
    enabled: true,
    missing: [...missing],
    ok: missing.length === 0
  };
}
