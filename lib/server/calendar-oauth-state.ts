import "server-only";

const fallbackRedirectPath = "/dashboard/trips/demo/timeline";
const maxStateAgeMs = 10 * 60 * 1000;
const stateCookieName = "wayline_calendar_oauth_state";

export type CalendarOAuthState = {
  createdAt: string;
  nonce: string;
  redirectTo: string;
};

export function createCalendarOAuthState(redirectTo: string) {
  const state: CalendarOAuthState = {
    createdAt: new Date().toISOString(),
    nonce: crypto.randomUUID(),
    redirectTo: isSafeInternalPath(redirectTo) ? redirectTo : fallbackRedirectPath
  };
  const encodedState = encodeOAuthState(state);

  return {
    cookie: serializeStateCookie(encodedState, maxStateAgeMs),
    encodedState
  };
}

export function validateCalendarOAuthState(
  encodedState: string | null,
  cookieHeader: string | null
) {
  const fallback = {
    clearCookie: serializeStateCookie("", 0),
    reason: "missing_state" as const,
    redirectTo: fallbackRedirectPath,
    valid: false
  };
  const state = decodeOAuthState(encodedState);

  if (!state) {
    return fallback;
  }

  const rawCookieState = readCookie(cookieHeader, stateCookieName);
  const cookieState = decodeOAuthState(rawCookieState);

  if (!rawCookieState || !cookieState) {
    return {
      ...fallback,
      reason: "missing_state_cookie" as const
    };
  }

  const createdAt = new Date(state.createdAt).getTime();
  const expired = !Number.isFinite(createdAt) || Date.now() - createdAt > maxStateAgeMs;
  const matchesCookie =
    state.nonce === cookieState.nonce &&
    state.createdAt === cookieState.createdAt &&
    state.redirectTo === cookieState.redirectTo;

  if (expired) {
    return {
      ...fallback,
      reason: "state_expired" as const
    };
  }

  if (!matchesCookie) {
    return {
      ...fallback,
      reason: "state_mismatch" as const
    };
  }

  if (!isSafeInternalPath(state.redirectTo)) {
    return {
      ...fallback,
      reason: "unsafe_redirect" as const
    };
  }

  return {
    clearCookie: serializeStateCookie("", 0),
    reason: null,
    redirectTo: state.redirectTo,
    valid: true
  };
}

export function isSafeInternalPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}

function encodeOAuthState(state: CalendarOAuthState) {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

function decodeOAuthState(value: string | null): CalendarOAuthState | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

    if (
      typeof parsed?.createdAt !== "string" ||
      typeof parsed?.nonce !== "string" ||
      typeof parsed?.redirectTo !== "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function serializeStateCookie(value: string, maxAgeSeconds: number) {
  const encodedValue = value ? encodeURIComponent(value) : "";
  const expires = maxAgeSeconds === 0 ? "; Expires=Thu, 01 Jan 1970 00:00:00 GMT" : "";

  return [
    `${stateCookieName}=${encodedValue}`,
    "Path=/api/calendar/oauth",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    expires
  ]
    .filter(Boolean)
    .join("; ");
}

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [rawName, ...rest] = cookie.trim().split("=");

    if (rawName === name) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}
