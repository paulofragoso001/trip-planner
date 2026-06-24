import type { CalendarProvider } from "@/lib/validators/calendar-sync";

const calendarCallbackPaths: Record<CalendarProvider, string> = {
  google: "/api/calendar/oauth/google/callback",
  outlook: "/api/calendar/oauth/outlook/callback"
};

const calendarRedirectEnvNames: Record<CalendarProvider, string> = {
  google: "GOOGLE_CALENDAR_REDIRECT_URI",
  outlook: "MICROSOFT_CALENDAR_REDIRECT_URI"
};

export function calendarCallbackPath(provider: CalendarProvider) {
  return calendarCallbackPaths[provider];
}

export function calendarRedirectEnvName(provider: CalendarProvider) {
  return calendarRedirectEnvNames[provider];
}

export function buildCalendarCallbackUrl(appUrl: string, provider: CalendarProvider) {
  const url = new URL(appUrl);
  return `${url.origin}${calendarCallbackPath(provider)}`;
}

export function resolveCalendarRedirectUri(provider: CalendarProvider) {
  const configuredRedirect = process.env[calendarRedirectEnvName(provider)] || null;

  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_APP_URL) {
    return buildCalendarCallbackUrl(process.env.NEXT_PUBLIC_APP_URL, provider);
  }

  return configuredRedirect;
}
