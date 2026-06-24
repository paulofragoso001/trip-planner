const authCallbackPath = "/auth/callback";

export function getAuthCallbackUrl(runtimeOrigin?: string | null) {
  const configuredOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);

  if (configuredOrigin) {
    return `${configuredOrigin}${authCallbackPath}`;
  }

  const fallbackOrigin = normalizeRuntimeFallbackOrigin(runtimeOrigin);

  if (fallbackOrigin) {
    return `${fallbackOrigin}${authCallbackPath}`;
  }

  return authCallbackPath;
}

export function getCanonicalAppUrl(path: string, fallbackBaseUrl: string) {
  const configuredOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
  return new URL(path, configuredOrigin || fallbackBaseUrl);
}

function normalizeRuntimeFallbackOrigin(origin?: string | null) {
  const normalized = normalizeOrigin(origin);

  if (!normalized) {
    return null;
  }

  const url = new URL(normalized);

  if (isLocalHost(url.hostname)) {
    return normalized;
  }

  return null;
}

function normalizeOrigin(origin?: string | null) {
  if (!origin) {
    return null;
  }

  try {
    const url = new URL(origin);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.origin.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function isLocalHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}
