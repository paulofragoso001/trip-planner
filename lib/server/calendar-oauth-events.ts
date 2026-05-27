import "server-only";

import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CalendarProvider } from "@/lib/validators/calendar-sync";

type CalendarOAuthEventType =
  | "oauth_callback_failure"
  | "oauth_callback_success"
  | "oauth_missing_state_cookie"
  | "oauth_start"
  | "oauth_state_mismatch"
  | "oauth_token_exchange_error"
  | "oauth_unsafe_redirect";

type CalendarOAuthEventInput = {
  connectionId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  eventType: CalendarOAuthEventType;
  metadata?: Record<string, unknown>;
  provider: CalendarProvider;
  redirectTo?: string | null;
  requestPath?: string | null;
  stateNonce?: string | null;
  userId?: string | null;
};

export async function recordCalendarOAuthEvent(input: CalendarOAuthEventInput) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  try {
    await admin.from("calendar_oauth_events").insert({
      connection_id: input.connectionId || null,
      error_code: input.errorCode || null,
      error_message: input.errorMessage ? input.errorMessage.slice(0, 500) : null,
      event_type: input.eventType,
      metadata: input.metadata || {},
      provider: input.provider,
      redirect_to: input.redirectTo || null,
      request_path: input.requestPath || null,
      state_nonce_hash: input.stateNonce ? hashStateNonce(input.stateNonce) : null,
      user_id: input.userId || null
    });
  } catch {
    // OAuth observability must never block connect/disconnect flows.
  }
}

function hashStateNonce(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
