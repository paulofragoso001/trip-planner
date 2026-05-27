import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const tokenUrl = process.env.GRAFANA_TOKEN_URL;
  const refreshToken = process.env.GRAFANA_REFRESH_TOKEN;
  const clientId = process.env.GRAFANA_CLIENT_ID;
  const clientSecret = process.env.GRAFANA_CLIENT_SECRET;

  if (!tokenUrl || !refreshToken || !clientId || !clientSecret) {
    return NextResponse.json(
      {
        error: "OAuth refresh is not configured. Use service account auth for Grafana automation."
      },
      { status: 501 }
    );
  }

  const response = await fetch(tokenUrl, {
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json(
      {
        error: payload ?? "OAuth refresh failed."
      },
      { status: response.status }
    );
  }

  return NextResponse.json({
    expires_in: payload?.expires_in ?? null,
    refreshed: true
  });
}
