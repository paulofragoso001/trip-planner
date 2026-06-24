import "server-only";

import { ApiError } from "@/lib/api/errors";
import {
  calendarRedirectEnvName,
  resolveCalendarRedirectUri
} from "@/lib/server/calendar-redirect-uri";
import {
  encryptCalendarToken,
  encryptCalendarTokenRecord
} from "@/lib/server/calendar-token-encryption";
import type { CalendarProvider } from "@/lib/validators/calendar-sync";

type SupabaseAdminClient = {
  from: (table: "calendar_connections" | "calendar_connection_tokens") => any;
};

type OAuthTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
};

type ProviderAccount = {
  email: string | null;
  id: string;
  name: string | null;
};

export async function exchangeAndStoreCalendarConnection({
  code,
  provider,
  supabase,
  userId
}: {
  code: string;
  provider: CalendarProvider;
  supabase: SupabaseAdminClient;
  userId: string;
}) {
  const token = await exchangeCodeForToken(provider, code);

  if (!token.access_token) {
    throw new ApiError("bad_gateway", "Calendar provider did not return an access token.", 502);
  }

  const account = await fetchProviderAccount(provider, token.access_token);
  const now = Date.now();
  const expiresIn = Math.max(0, token.expires_in ?? 3600);
  const refreshExpiresIn = token.refresh_token_expires_in;
  const scopes = splitScopes(token.scope);

  if (!token.refresh_token) {
    throw new ApiError(
      "bad_gateway",
      "Calendar provider did not return a refresh token.",
      502
    );
  }

  const { data: connection, error } = await supabase
    .from("calendar_connections")
    .upsert(
      {
        calendar_events_scope: scopes.find((scope) => scope.includes("Calendar")) ?? null,
        last_error: null,
        provider,
        provider_account_email: account.email,
        provider_account_id: account.id,
        provider_account_name: account.name,
        scopes,
        status: "active",
        token_rotation_locked_at: null,
        token_rotation_lock_owner: null,
        user_id: userId
      },
      { onConflict: "user_id,provider" }
    )
    .select("id,current_token_version,provider,provider_account_email,status")
    .single();

  if (error) {
    throw new ApiError("internal_error", "Could not store calendar connection.", 500, {
      supabaseMessage: error.message
    });
  }

  const tokenSet = encryptCalendarTokenRecord(`${token.access_token}:${token.refresh_token}`);
  const nextTokenVersion = Number(connection.current_token_version || 0) + 1;

  await supabase
    .from("calendar_connection_tokens")
    .update({
      is_current: false,
      rotated_at: new Date(now).toISOString()
    })
    .eq("connection_id", connection.id)
    .eq("is_current", true);

  const { error: tokenError } = await supabase.from("calendar_connection_tokens").insert({
    access_token_ciphertext: encryptCalendarToken(token.access_token),
    access_token_expires_at: new Date(now + expiresIn * 1000).toISOString(),
    connection_id: connection.id,
    is_current: true,
    refresh_token_ciphertext: encryptCalendarToken(token.refresh_token),
    refresh_token_expires_at: refreshExpiresIn
      ? new Date(now + refreshExpiresIn * 1000).toISOString()
      : null,
    token_key_id: tokenSet.keyId,
    token_nonce: tokenSet.nonce,
    token_version: nextTokenVersion
  });

  if (tokenError) {
    throw new ApiError("internal_error", "Could not store encrypted calendar tokens.", 500, {
      supabaseMessage: tokenError.message
    });
  }

  await supabase
    .from("calendar_connections")
    .update({
      current_token_version: nextTokenVersion,
      token_rotation_locked_at: null,
      token_rotation_lock_owner: null
    })
    .eq("id", connection.id);

  return connection;
}

async function exchangeCodeForToken(provider: CalendarProvider, code: string) {
  if (provider === "google") {
    return postForm("https://oauth2.googleapis.com/token", {
      client_id: readEnv("GOOGLE_CALENDAR_CLIENT_ID"),
      client_secret: readEnv("GOOGLE_CALENDAR_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
      redirect_uri: readRedirectUri("google")
    });
  }

  const tenant = process.env.MICROSOFT_CALENDAR_TENANT_ID || "common";
  return postForm(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    client_id: readEnv("MICROSOFT_CALENDAR_CLIENT_ID"),
    client_secret: readEnv("MICROSOFT_CALENDAR_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: readRedirectUri("outlook")
  });
}

async function fetchProviderAccount(
  provider: CalendarProvider,
  accessToken: string
): Promise<ProviderAccount> {
  if (provider === "google") {
    const profile = await getJson<Record<string, unknown>>(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      accessToken
    );

    return {
      email: readString(profile.email) || null,
      id: readString(profile.sub),
      name: readString(profile.name) || null
    };
  }

  const profile = await getJson<Record<string, unknown>>(
    "https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName,mail",
    accessToken
  );

  return {
    email: readString(profile.mail) || readString(profile.userPrincipalName) || null,
    id: readString(profile.id),
    name: readString(profile.displayName) || null
  };
}

async function postForm(url: string, body: Record<string, string>) {
  const response = await fetch(url, {
    body: new URLSearchParams(body),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST"
  });
  const payload = (await response.json().catch(() => ({}))) as OAuthTokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (!response.ok) {
    throw new ApiError("bad_gateway", "Calendar OAuth token exchange failed.", 502, {
      providerError: payload.error,
      providerMessage: payload.error_description
    });
  }

  return payload;
}

async function getJson<TPayload>(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = (await response.json().catch(() => ({}))) as TPayload;

  if (!response.ok) {
    throw new ApiError("bad_gateway", "Could not load calendar provider account.", 502);
  }

  return payload;
}

function readEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new ApiError("not_implemented", `${name} is not configured.`, 501, {
      requiredEnv: name
    });
  }

  return value;
}

function readRedirectUri(provider: CalendarProvider) {
  const value = resolveCalendarRedirectUri(provider);

  if (!value) {
    const requiredEnv = calendarRedirectEnvName(provider);
    throw new ApiError("not_implemented", `${requiredEnv} is not configured.`, 501, {
      requiredEnv
    });
  }

  return value;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function splitScopes(scope: string | undefined) {
  return scope ? scope.split(/\s+/).filter(Boolean) : [];
}
