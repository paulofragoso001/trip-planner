export function isAllowedSessionMutationRequest(
  request: Request,
  options: { allowTestBypass?: boolean } = {}
) {
  if (
    options.allowTestBypass &&
    request.headers.get("x-cypress-dashboard") === "true"
  ) {
    return true;
  }

  const origin = request.headers.get("origin");
  if (origin && isAllowedRequestOrigin(request, origin)) {
    return true;
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin" || secFetchSite === "same-site") {
    return true;
  }

  const referer = request.headers.get("referer");
  return Boolean(!origin && referer && isAllowedRequestOrigin(request, referer));
}

function isAllowedRequestOrigin(request: Request, value: string) {
  const candidate = parseUrl(value);
  if (!candidate) return false;

  const requestUrl = parseUrl(request.url);
  if (requestUrl && candidate.origin === requestUrl.origin) {
    return true;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!appUrl) return false;

  const canonicalAppUrl = parseUrl(appUrl);
  return Boolean(canonicalAppUrl && candidate.origin === canonicalAppUrl.origin);
}

function parseUrl(value: string) {
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }
}
