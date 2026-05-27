import "server-only";

import crypto from "node:crypto";
import { ApiError } from "@/lib/api/errors";
import {
  decryptCalendarToken,
  encryptCalendarToken
} from "@/lib/server/calendar-token-encryption";
import type { CalendarProvider } from "@/lib/validators/calendar-sync";

type SupabaseAdminClient = {
  from: (table: "calendar_connections" | "calendar_connection_tokens") => any;
};

type CalendarConnectionTokenRow = {
  connection_id: string;
  id: string;
  refresh_token_ciphertext: string;
  token_version: number;
};

type CalendarConnectionRow = {
  current_token_version: number;
  id: string;
  provider: CalendarProvider;
};

type RefreshTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
};

export async function refreshCalendarConnectionToken(
  supabase: SupabaseAdminClient,
  connectionId: string
) {
  const lockOwner = `refresh-${cryptoRandomId()}`;
  const { data: connection, error } = await supabase
    .from("calendar_connections")
    .select("id,provider,current_token_version")
    .eq("id", connectionId)
    .single();

  if (error) {
    throw new ApiError("internal_error", "Could not load calendar connection.", 500, {
      supabaseMessage: error.message
    });
  }

  const row = connection as CalendarConnectionRow;
  const locked = await acquireRotationLock(supabase, row.id, lockOwner);

  if (!locked) {
    throw new ApiError("bad_request", "Calendar token rotation is already in progress.", 409);
  }

  const { data: tokenRow, error: tokenError } = await supabase
    .from("calendar_connection_tokens")
    .select("id,connection_id,refresh_token_ciphertext,token_version")
    .eq("connection_id", row.id)
    .eq("is_current", true)
    .single();

  if (tokenError || !tokenRow) {
    await markNeedsReauth(supabase, row.id, "Missing current calendar refresh token.");
    await releaseRotationLock(supabase, row.id, lockOwner);
    throw new ApiError("unauthorized", "Calendar connection requires reauthorization.", 401);
  }

  const currentToken = tokenRow as CalendarConnectionTokenRow;
  const refreshToken = decryptCalendarToken(currentToken.refresh_token_ciphertext);
  const refreshed = await refreshProviderToken(row.provider, refreshToken);

  if (!refreshed.access_token) {
    await markNeedsReauth(
      supabase,
      row.id,
      refreshed.error_description || refreshed.error || "Calendar refresh failed."
    );
    await markTokenReuseDetected(supabase, currentToken.id, refreshed.error === "invalid_grant");
    await releaseRotationLock(supabase, row.id, lockOwner);
    throw new ApiError("unauthorized", "Calendar connection requires reauthorization.", 401);
  }

  const nextRefreshToken = refreshed.refresh_token ?? refreshToken;
  const rotatedRefreshToken = nextRefreshToken !== refreshToken;
  const expiresIn = Math.max(0, refreshed.expires_in ?? 3600);
  const scopes = refreshed.scope ? refreshed.scope.split(/\s+/).filter(Boolean) : undefined;
  const nextVersion = row.current_token_version + 1;

  await supabase
    .from("calendar_connection_tokens")
    .update({
      is_current: false,
      rotated_at: rotatedRefreshToken ? new Date().toISOString() : null
    })
    .eq("id", currentToken.id);

  const { error: insertError } = await supabase.from("calendar_connection_tokens").insert({
    access_token_ciphertext: encryptCalendarToken(refreshed.access_token),
    access_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    connection_id: row.id,
    is_current: true,
    refresh_token_ciphertext: encryptCalendarToken(nextRefreshToken),
    rotated_from_token_id: currentToken.id,
    token_key_id: process.env.CALENDAR_TOKEN_KEY_ID || "default",
    token_nonce: cryptoRandomId(),
    token_version: nextVersion
  });

  if (insertError) {
    await releaseRotationLock(supabase, row.id, lockOwner);
    throw new ApiError("internal_error", "Could not update calendar token.", 500, {
      supabaseMessage: insertError.message
    });
  }

  const { data, error: updateError } = await supabase
    .from("calendar_connections")
    .update({
      current_token_version: nextVersion,
      last_error: null,
      scopes,
      status: "active",
      token_rotation_locked_at: null,
      token_rotation_lock_owner: null
    })
    .eq("id", row.id)
    .eq("token_rotation_lock_owner", lockOwner)
    .select("id,status,current_token_version")
    .single();

  if (updateError) {
    await releaseRotationLock(supabase, row.id, lockOwner);
    throw new ApiError("internal_error", "Could not update calendar connection.", 500, {
      supabaseMessage: updateError.message
    });
  }

  return data;
}

async function refreshProviderToken(provider: CalendarProvider, refreshToken: string) {
  if (provider === "google") {
    return postForm("https://oauth2.googleapis.com/token", {
      client_id: readEnv("GOOGLE_CALENDAR_CLIENT_ID"),
      client_secret: readEnv("GOOGLE_CALENDAR_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken
    });
  }

  const tenant = process.env.MICROSOFT_CALENDAR_TENANT_ID || "common";
  return postForm(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    client_id: readEnv("MICROSOFT_CALENDAR_CLIENT_ID"),
    client_secret: readEnv("MICROSOFT_CALENDAR_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });
}

async function postForm(url: string, body: Record<string, string>) {
  const response = await fetch(url, {
    body: new URLSearchParams(body),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST"
  });
  const payload = (await response.json().catch(() => ({}))) as RefreshTokenResponse;

  if (!response.ok && payload.error !== "invalid_grant") {
    throw new ApiError("bad_gateway", "Calendar token refresh failed.", 502, {
      providerError: payload.error,
      providerMessage: payload.error_description
    });
  }

  return payload;
}

async function markNeedsReauth(
  supabase: SupabaseAdminClient,
  connectionId: string,
  lastError: string
) {
  await supabase
    .from("calendar_connections")
    .update({
      last_error: lastError,
      token_rotation_locked_at: null,
      token_rotation_lock_owner: null,
      status: "needs_reauth"
    })
    .eq("id", connectionId);
}

async function acquireRotationLock(
  supabase: SupabaseAdminClient,
  connectionId: string,
  lockOwner: string
) {
  const staleCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("calendar_connections")
    .update({
      token_rotation_locked_at: new Date().toISOString(),
      token_rotation_lock_owner: lockOwner
    })
    .eq("id", connectionId)
    .or(`token_rotation_locked_at.is.null,token_rotation_locked_at.lt.${staleCutoff}`)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new ApiError("internal_error", "Could not lock calendar token rotation.", 500, {
      supabaseMessage: error.message
    });
  }

  return Boolean(data);
}

async function releaseRotationLock(
  supabase: SupabaseAdminClient,
  connectionId: string,
  lockOwner: string
) {
  await supabase
    .from("calendar_connections")
    .update({
      token_rotation_locked_at: null,
      token_rotation_lock_owner: null
    })
    .eq("id", connectionId)
    .eq("token_rotation_lock_owner", lockOwner);
}

async function markTokenReuseDetected(
  supabase: SupabaseAdminClient,
  tokenId: string,
  reuseDetected: boolean
) {
  if (!reuseDetected) {
    return;
  }

  await supabase
    .from("calendar_connection_tokens")
    .update({
      reuse_detected_at: new Date().toISOString(),
      revoked_at: new Date().toISOString()
    })
    .eq("id", tokenId);
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

function cryptoRandomId() {
  return crypto.randomUUID();
}
