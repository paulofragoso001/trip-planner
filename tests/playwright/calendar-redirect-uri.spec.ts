import { expect, test } from "@playwright/test";

import {
  buildCalendarCallbackUrl,
  resolveCalendarRedirectUri
} from "../../lib/server/calendar-redirect-uri";

test("Almidy production Google Calendar callback is derived from the canonical app URL", () => {
  expect(buildCalendarCallbackUrl("https://almidy.app", "google")).toBe(
    "https://almidy.app/api/calendar/oauth/google/callback"
  );
});

test("production Calendar OAuth redirect uses Almidy even when a stale redirect env remains", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalGoogleRedirect = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_APP_URL = "https://almidy.app";
  process.env.GOOGLE_CALENDAR_REDIRECT_URI =
    "https://trip-planner-swart-sigma.vercel.app/api/calendar/oauth/google/callback";

  try {
    expect(resolveCalendarRedirectUri("google")).toBe(
      "https://almidy.app/api/calendar/oauth/google/callback"
    );
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    restoreEnv("NEXT_PUBLIC_APP_URL", originalAppUrl);
    restoreEnv("GOOGLE_CALENDAR_REDIRECT_URI", originalGoogleRedirect);
  }
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
