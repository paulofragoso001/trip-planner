import { apiCanonicalSuccess, apiFailure, handleApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/server/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const routeName = "admin/import-parse-metrics";
const terminalEventTypes = new Set(["correction", "dismissal", "promotion"]);

type ImportParseMetricEvent = {
  confidence: number | null;
  created_at: string;
  event_type: "correction" | "dismissal" | "prediction" | "promotion";
  final_segment_type: string | null;
  parser_name: string;
  parser_version: string;
  predicted_segment_type: string | null;
  source_type: string;
  unfiled_item_id: string | null;
};

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) {
      return adminAuthFailure(auth.reason);
    }

    const admin = createAdminClient();
    if (!admin) {
      return apiFailure(
        "internal_error",
        "SUPABASE_SERVICE_ROLE_KEY is not configured.",
        503
      );
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data, error } = await admin
      .from("import_parse_events")
      .select(
        "confidence,created_at,event_type,final_segment_type,parser_name,parser_version,predicted_segment_type,source_type,unfiled_item_id"
      )
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: true })
      .limit(5000);

    if (error) {
      return apiFailure("internal_error", error.message, 500);
    }

    const events = (data || []) as ImportParseMetricEvent[];
    const oneMinute = countSince(events, now, 60 * 1000);
    const fiveMinutes = countSince(events, now, 5 * 60 * 1000);
    const oneHour = countSince(events, now, 60 * 60 * 1000);
    const twentyFourHours = events.filter(
      (event) => new Date(event.created_at).getTime() >= now.getTime() - 24 * 60 * 60 * 1000
    );
    const terminalEvents24h = twentyFourHours.filter((event) =>
      terminalEventTypes.has(event.event_type)
    );
    const dismissals24h = twentyFourHours.filter(
      (event) => event.event_type === "dismissal"
    ).length;
    const corrections24h = twentyFourHours.filter(
      (event) => event.event_type === "correction"
    ).length;
    const promotions24h = twentyFourHours.filter(
      (event) => event.event_type === "promotion"
    ).length;
    const predictions24h = twentyFourHours.filter(
      (event) => event.event_type === "prediction"
    ).length;
    const reviewLatencies = calculateReviewLatencies(events);

    return apiCanonicalSuccess({
      generatedAt: now.toISOString(),
      throughput: {
        eventsPerMinute: oneMinute,
        eventsLast5Minutes: fiveMinutes,
        eventsLastHour: oneHour,
        eventsLast24Hours: twentyFourHours.length
      },
      outcomes24h: {
        corrections: corrections24h,
        dismissals: dismissals24h,
        dismissalRatePct: rate(dismissals24h, terminalEvents24h.length),
        predictions: predictions24h,
        promotions: promotions24h,
        reviewEvents: terminalEvents24h.length
      },
      latency: {
        label: "prediction_to_review",
        samples: reviewLatencies.length,
        p50Seconds: percentile(reviewLatencies, 0.5),
        p95Seconds: percentile(reviewLatencies, 0.95)
      },
      failureRate: {
        failedEvents24h: dismissals24h,
        failureRatePct: rate(dismissals24h, terminalEvents24h.length)
      },
      sourceBreakdown: buildSourceBreakdown(twentyFourHours)
    });
  } catch (error) {
    return handleApiError(error, routeName);
  }
}

function adminAuthFailure(reason: "forbidden" | "unauthorized") {
  return reason === "unauthorized"
    ? apiFailure("unauthorized", "Unauthorized", 401)
    : apiFailure("forbidden", "Forbidden", 403);
}

function countSince(events: ImportParseMetricEvent[], now: Date, windowMs: number) {
  const cutoff = now.getTime() - windowMs;
  return events.filter((event) => new Date(event.created_at).getTime() >= cutoff).length;
}

function calculateReviewLatencies(events: ImportParseMetricEvent[]) {
  const predictionsByItem = new Map<string, number>();
  const latencies: number[] = [];

  for (const event of events) {
    if (!event.unfiled_item_id) {
      continue;
    }

    const eventTime = new Date(event.created_at).getTime();

    if (event.event_type === "prediction" && !predictionsByItem.has(event.unfiled_item_id)) {
      predictionsByItem.set(event.unfiled_item_id, eventTime);
      continue;
    }

    if (!terminalEventTypes.has(event.event_type)) {
      continue;
    }

    const predictionTime = predictionsByItem.get(event.unfiled_item_id);
    if (predictionTime == null || eventTime < predictionTime) {
      continue;
    }

    latencies.push(Math.round((eventTime - predictionTime) / 1000));
    predictionsByItem.delete(event.unfiled_item_id);
  }

  return latencies.sort((a, b) => a - b);
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) {
    return null;
  }

  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil(values.length * percentileValue) - 1)
  );
  return values[index];
}

function rate(numerator: number, denominator: number) {
  if (!denominator) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(2));
}

function buildSourceBreakdown(events: ImportParseMetricEvent[]) {
  const bySource = new Map<
    string,
    { corrections: number; dismissals: number; events: number; predictions: number; promotions: number }
  >();

  for (const event of events) {
    const current =
      bySource.get(event.source_type) ||
      { corrections: 0, dismissals: 0, events: 0, predictions: 0, promotions: 0 };
    current.events += 1;

    if (event.event_type === "correction") {
      current.corrections += 1;
    }
    if (event.event_type === "dismissal") {
      current.dismissals += 1;
    }
    if (event.event_type === "prediction") {
      current.predictions += 1;
    }
    if (event.event_type === "promotion") {
      current.promotions += 1;
    }

    bySource.set(event.source_type, current);
  }

  return Array.from(bySource, ([sourceType, counts]) => ({
    ...counts,
    dismissalRatePct: rate(
      counts.dismissals,
      counts.corrections + counts.dismissals + counts.promotions
    ),
    sourceType
  })).sort((a, b) => b.events - a.events);
}
