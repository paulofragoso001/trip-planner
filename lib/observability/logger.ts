import "server-only";

import { redactPanelErrorReport } from "@/lib/panel-error-reporting";
import { createAdminClient } from "@/lib/supabase/admin";

type ApiLogContext = {
  error: unknown;
  route: string;
  status: number;
};

export function logApiError({ error, route, status }: ApiLogContext) {
  const normalized =
    error instanceof Error
      ? {
          message: error.message,
          name: error.name,
          stack: error.stack
        }
      : {
          message: String(error)
        };

  const report = redactPanelErrorReport({
    message: normalized.message,
    name: normalized.name,
    panelName: `api:${route}`,
    payload: { route, status },
    source: "global-error",
    stack: normalized.stack
  });

  console.error("API error", report);
  void recordApiErrorEvent({
    message: normalized.message,
    name: normalized.name,
    route,
    status
  }).catch(() => {
    // API logging must never make the original error path noisier.
  });
}

async function recordApiErrorEvent({
  message,
  name,
  route,
  status
}: {
  message: string;
  name?: string;
  route: string;
  status: number;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  await admin.from("api_error_events").insert({
    error_message: message,
    error_name: name || null,
    metadata: {},
    route,
    status
  });
}
