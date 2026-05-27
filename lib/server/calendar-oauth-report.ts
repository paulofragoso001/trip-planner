import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type CalendarOAuthKpi = {
  callback_failures: number;
  callback_failure_rate_pct: number | null;
  callback_successes: number;
  missing_state_cookies: number;
  provider: string;
  starts: number;
  state_mismatches: number;
  unsafe_redirects: number;
};

export type CalendarOAuthFailureTrend = {
  bucket: string;
  callback_failures: number;
  missing_state_cookies: number;
  provider: string;
  state_mismatches: number;
  token_exchange_errors: number;
  unsafe_redirects: number;
};

export type CalendarOAuthRedirectAnomaly = {
  created_at: string;
  error_code: string | null;
  error_message: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  provider: string;
  redirect_to: string | null;
  request_path: string | null;
};

export type CalendarOAuthReport = {
  anomalies: CalendarOAuthRedirectAnomaly[];
  error: string | null;
  kpis: CalendarOAuthKpi[];
  trend: CalendarOAuthFailureTrend[];
};

export async function getCalendarOAuthReport(): Promise<CalendarOAuthReport> {
  const admin = createAdminClient();

  if (!admin) {
    return {
      anomalies: [],
      error: "SUPABASE_SERVICE_ROLE_KEY is not configured.",
      kpis: [],
      trend: []
    };
  }

  try {
    const [kpis, trend, anomalies] = await Promise.all([
      admin
        .from("calendar_oauth_kpis_24h")
        .select("*")
        .order("provider", { ascending: true }),
      admin
        .from("calendar_oauth_failure_trend_7d")
        .select("*")
        .limit(24),
      admin
        .from("calendar_oauth_redirect_anomalies_7d")
        .select("*")
        .limit(8)
    ]);

    const error = kpis.error || trend.error || anomalies.error;

    if (error) {
      return {
        anomalies: [],
        error: error.message,
        kpis: [],
        trend: []
      };
    }

    return {
      anomalies: (anomalies.data || []) as CalendarOAuthRedirectAnomaly[],
      error: null,
      kpis: (kpis.data || []) as CalendarOAuthKpi[],
      trend: (trend.data || []) as CalendarOAuthFailureTrend[]
    };
  } catch (error) {
    return {
      anomalies: [],
      error:
        error instanceof Error
          ? error.message
          : "Could not load calendar OAuth observability report.",
      kpis: [],
      trend: []
    };
  }
}
