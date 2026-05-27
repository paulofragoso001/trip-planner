import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type ImportParseKpi = {
  correction_rate_pct: number | null;
  corrections: number;
  dismissal_rate_pct: number | null;
  dismissals: number;
  parser_name: string;
  parser_version: string;
  predictions: number;
  promotions: number;
  source_type: string;
};

export type ImportParseAccuracy = {
  matching_segment_type_events: number;
  parser_name: string;
  parser_version: string;
  reviewed_events: number;
  segment_type_accuracy_pct: number | null;
  source_type: string;
};

export type ImportParseRecentEvent = {
  confidence: number | null;
  correction_payload: Record<string, unknown>;
  created_at: string;
  event_type: string;
  final_segment_type: string | null;
  parser_name: string;
  parser_version: string;
  predicted_segment_type: string | null;
  source_label: string | null;
  source_type: string;
};

export type ImportParseAccuracyTrend = {
  bucket: string;
  matchingEvents: number;
  parserName: string;
  parserVersion: string;
  reviewedEvents: number;
  segmentTypeAccuracyPct: number | null;
};

export type ImportParseCorrectionBySegmentType = {
  correctionRatePct: number | null;
  corrections: number;
  reviewedEvents: number;
  segmentType: string;
};

export type ImportParseAnomaly = {
  affectedEvents: number;
  detectedAt: string;
  detail: string;
  fingerprint: string;
  impactScore: number;
  label: string;
  relatedEvents: ImportParseAnomalyEvent[];
  resolutionStatus: ImportParseAnomalyReviewStatus | "unreviewed";
  resolvedAt: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewStatus: ImportParseAnomalyReviewStatus | "unreviewed";
  severity: "info" | "warning";
  value: string;
};

export type ImportParseAnomalyReviewStatus =
  | "confirmed"
  | "false_positive"
  | "pending"
  | "resolved";

export type ImportParseAnomalyReview = {
  anomaly_fingerprint: string;
  anomaly_label: string;
  created_at: string;
  detected_at: string;
  id: string;
  note: string | null;
  resolved_at: string | null;
  reviewed_at: string | null;
  status: ImportParseAnomalyReviewStatus;
  updated_at: string;
  user_id: string;
};

export type ImportParseAnomalyEvent = {
  confidence: number | null;
  createdAt: string;
  eventType: string;
  finalSegmentType: string | null;
  id: string;
  parserName: string;
  parserVersion: string;
  predictedSegmentType: string | null;
  sourceLabel: string | null;
  sourceType: string;
  unfiledItemId: string | null;
};

export type ImportParseReport = {
  accuracy: ImportParseAccuracy[];
  accuracyTrend: ImportParseAccuracyTrend[];
  anomalies: ImportParseAnomaly[];
  correctionBySegmentType: ImportParseCorrectionBySegmentType[];
  error: string | null;
  kpis: ImportParseKpi[];
  recentEvents: ImportParseRecentEvent[];
  loadedAt: string;
  weeklyScorecard: ImportParseWeeklyScorecard;
};

export type ImportParseWeeklyScorecard = {
  accuracyDropAnomalies: number;
  anomalyCount: number;
  correctionSpikeAnomalies: number;
  falsePositiveRatePct: number | null;
  meanTimeToResolutionHours: number | null;
  pendingAnomalies: number;
  reviewedEvents: number;
  reviewedAnomalies: number;
  resolvedAnomalies: number;
  totalImpactScore: number;
};

type ImportParseTrendEvent = {
  confidence: number | null;
  created_at: string;
  event_type: "correction" | "dismissal" | "prediction" | "promotion";
  final_segment_type: string | null;
  id: string;
  parser_name: string;
  parser_version: string;
  predicted_segment_type: string | null;
  source_label: string | null;
  source_type: string;
  unfiled_item_id: string | null;
};

const reviewedEventTypes = new Set(["correction", "dismissal", "promotion"]);

export async function getImportParseReport(): Promise<ImportParseReport> {
  const admin = createAdminClient();
  const loadedAt = new Date().toISOString();

  if (!admin) {
    return {
      accuracy: [],
      accuracyTrend: [],
      anomalies: [],
      correctionBySegmentType: [],
      error: "SUPABASE_SERVICE_ROLE_KEY is not configured.",
      kpis: [],
      loadedAt,
      recentEvents: [],
      weeklyScorecard: emptyWeeklyScorecard()
    };
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [kpis, accuracy, recentEvents, trendEvents] = await Promise.all([
      admin
        .from("import_parse_kpis_24h")
        .select("*")
        .order("parser_version", { ascending: false })
        .order("source_type", { ascending: true }),
      admin
        .from("import_parse_accuracy_7d")
        .select("*")
        .order("parser_version", { ascending: false })
        .order("source_type", { ascending: true }),
      admin
        .from("import_parse_recent_events")
        .select("*")
        .limit(8),
      admin
        .from("import_parse_events")
        .select(
          "confidence,created_at,event_type,final_segment_type,id,parser_name,parser_version,predicted_segment_type,source_label,source_type,unfiled_item_id"
        )
        .gte("created_at", sevenDaysAgo)
        .in("event_type", ["correction", "dismissal", "promotion"])
        .order("created_at", { ascending: true })
        .limit(5000)
    ]);

    const error = kpis.error || accuracy.error || recentEvents.error || trendEvents.error;

    if (error) {
      return {
        accuracy: [],
        accuracyTrend: [],
        anomalies: [],
        correctionBySegmentType: [],
        error: error.message,
        kpis: [],
        loadedAt,
        recentEvents: [],
        weeklyScorecard: emptyWeeklyScorecard()
      };
    }

    const accuracyTrend = buildAccuracyTrend(
      (trendEvents.data || []) as ImportParseTrendEvent[]
    );
    const correctionBySegmentType = buildCorrectionBySegmentType(
      (trendEvents.data || []) as ImportParseTrendEvent[]
    );
    const baseAnomalies = buildAnomalies(
      accuracyTrend,
      correctionBySegmentType,
      (trendEvents.data || []) as ImportParseTrendEvent[],
      loadedAt
    );
    const reviewRows = await loadAnomalyReviews(admin, baseAnomalies);
    const anomalies = applyReviewRows(baseAnomalies, reviewRows);
    const weeklyScorecard = buildWeeklyScorecard(
      (trendEvents.data || []) as ImportParseTrendEvent[],
      anomalies
    );

    return {
      accuracy: (accuracy.data || []) as ImportParseAccuracy[],
      accuracyTrend,
      anomalies,
      correctionBySegmentType,
      error: null,
      kpis: (kpis.data || []) as ImportParseKpi[],
      loadedAt,
      recentEvents: (recentEvents.data || []) as ImportParseRecentEvent[],
      weeklyScorecard
    };
  } catch (error) {
    return {
      accuracy: [],
      accuracyTrend: [],
      anomalies: [],
      correctionBySegmentType: [],
      error:
        error instanceof Error
          ? error.message
          : "Could not load import parse observability report.",
      kpis: [],
      loadedAt,
      recentEvents: [],
      weeklyScorecard: emptyWeeklyScorecard()
    };
  }
}

function buildAnomalies(
  accuracyTrend: ImportParseAccuracyTrend[],
  correctionBySegmentType: ImportParseCorrectionBySegmentType[],
  events: ImportParseTrendEvent[],
  loadedAt: string
): ImportParseAnomaly[] {
  const anomalies: ImportParseAnomaly[] = [];
  const accuracyByParser = new Map<string, ImportParseAccuracyTrend[]>();

  for (const row of accuracyTrend) {
    const key = `${row.parserName}:${row.parserVersion}`;
    accuracyByParser.set(key, [...(accuracyByParser.get(key) || []), row]);
  }

  for (const rows of accuracyByParser.values()) {
    const sortedRows = rows
      .filter((row) => row.segmentTypeAccuracyPct != null)
      .sort((a, b) => a.bucket.localeCompare(b.bucket));

    if (sortedRows.length < 2) {
      continue;
    }

    const latest = sortedRows[sortedRows.length - 1];
    const previousRows = sortedRows.slice(0, -1);
    const previousAverage =
      previousRows.reduce((sum, row) => sum + Number(row.segmentTypeAccuracyPct || 0), 0) /
      previousRows.length;
    const drop = previousAverage - Number(latest.segmentTypeAccuracyPct || 0);

    if (latest.reviewedEvents >= 3 && drop >= 15) {
      const relatedEvents = events
        .filter(
          (event) =>
            event.created_at.startsWith(latest.bucket) &&
            event.parser_name === latest.parserName &&
            event.parser_version === latest.parserVersion &&
            event.predicted_segment_type != null &&
            event.final_segment_type != null
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 4)
        .map(mapAnomalyEvent);

      anomalies.push({
        affectedEvents: latest.reviewedEvents,
        detectedAt: latest.bucket,
        detail: `${latest.parserName} ${latest.parserVersion} is down ${drop.toFixed(
          1
        )} points from its prior 7-day average.`,
        impactScore: calculateImpactScore({
          affectedEvents: latest.reviewedEvents,
          detectedAt: latest.bucket,
          loadedAt,
          severity: drop >= 30 ? "warning" : "info"
        }),
        label: "Accuracy drop",
        fingerprint: `accuracy_drop:${latest.parserName}:${latest.parserVersion}:${latest.bucket}`,
        relatedEvents,
        resolutionStatus: "unreviewed",
        resolvedAt: null,
        reviewNote: null,
        reviewedAt: null,
        reviewStatus: "unreviewed",
        severity: drop >= 30 ? "warning" : "info",
        value: `${formatNumber(latest.segmentTypeAccuracyPct)}%`
      });
    }
  }

  for (const row of correctionBySegmentType) {
    if (row.reviewedEvents >= 5 && Number(row.correctionRatePct || 0) >= 40) {
      const relatedEvents = events
        .filter((event) => {
          const segmentType =
            event.final_segment_type || event.predicted_segment_type || "unknown";
          return event.event_type === "correction" && segmentType === row.segmentType;
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 4)
        .map(mapAnomalyEvent);
      const detectedAt = relatedEvents[0]?.createdAt || new Date(0).toISOString();
      const severity = Number(row.correctionRatePct || 0) >= 60 ? "warning" : "info";

      anomalies.push({
        affectedEvents: row.reviewedEvents,
        detectedAt,
        detail: `${row.segmentType} segments have ${row.corrections} corrections across ${row.reviewedEvents} reviewed events.`,
        impactScore: calculateImpactScore({
          affectedEvents: row.reviewedEvents,
          detectedAt,
          loadedAt,
          severity
        }),
        label: "Correction spike",
        fingerprint: `correction_spike:${row.segmentType}:${detectedAt.slice(0, 10)}`,
        relatedEvents,
        resolutionStatus: "unreviewed",
        resolvedAt: null,
        reviewNote: null,
        reviewedAt: null,
        reviewStatus: "unreviewed",
        severity,
        value: `${formatNumber(row.correctionRatePct)}%`
      });
    }
  }

  return anomalies.sort((a, b) => b.impactScore - a.impactScore).slice(0, 6);
}

function buildWeeklyScorecard(
  events: ImportParseTrendEvent[],
  anomalies: ImportParseAnomaly[]
): ImportParseWeeklyScorecard {
  const reviewedAnomalies = anomalies.filter(
    (anomaly) => anomaly.reviewStatus !== "pending" && anomaly.reviewStatus !== "unreviewed"
  );
  const falsePositiveAnomalies = reviewedAnomalies.filter(
    (anomaly) => anomaly.reviewStatus === "false_positive"
  );
  const resolvedAnomalies = anomalies.filter((anomaly) => anomaly.resolvedAt);
  const resolutionDurations = resolvedAnomalies
    .map((anomaly) => {
      if (!anomaly.resolvedAt) {
        return null;
      }

      return (
        new Date(anomaly.resolvedAt).getTime() - new Date(anomaly.detectedAt).getTime()
      ) / (60 * 60 * 1000);
    })
    .filter((value): value is number => value != null && Number.isFinite(value) && value >= 0);

  return {
    accuracyDropAnomalies: anomalies.filter((anomaly) => anomaly.label === "Accuracy drop").length,
    anomalyCount: anomalies.length,
    correctionSpikeAnomalies: anomalies.filter((anomaly) => anomaly.label === "Correction spike")
      .length,
    falsePositiveRatePct: reviewedAnomalies.length
      ? Number(((falsePositiveAnomalies.length / reviewedAnomalies.length) * 100).toFixed(2))
      : null,
    meanTimeToResolutionHours: resolutionDurations.length
      ? Number(
          (
            resolutionDurations.reduce((sum, value) => sum + value, 0) /
            resolutionDurations.length
          ).toFixed(2)
        )
      : null,
    pendingAnomalies: anomalies.filter(
      (anomaly) => anomaly.reviewStatus === "pending" || anomaly.reviewStatus === "unreviewed"
    ).length,
    reviewedEvents: events.filter((event) => reviewedEventTypes.has(event.event_type)).length,
    reviewedAnomalies: reviewedAnomalies.length,
    resolvedAnomalies: resolvedAnomalies.length,
    totalImpactScore: anomalies.reduce((sum, anomaly) => sum + anomaly.impactScore, 0)
  };
}

async function loadAnomalyReviews(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  anomalies: ImportParseAnomaly[]
): Promise<ImportParseAnomalyReview[]> {
  const fingerprints = anomalies.map((anomaly) => anomaly.fingerprint);

  if (!fingerprints.length) {
    return [];
  }

  const { data, error } = await admin
    .from("import_parse_anomaly_reviews")
    .select(
      "anomaly_fingerprint,anomaly_label,created_at,detected_at,id,note,resolved_at,reviewed_at,status,updated_at,user_id"
    )
    .in("anomaly_fingerprint", fingerprints)
    .order("updated_at", { ascending: false });

  if (error) {
    return [];
  }

  return (data || []) as ImportParseAnomalyReview[];
}

function applyReviewRows(
  anomalies: ImportParseAnomaly[],
  reviewRows: ImportParseAnomalyReview[]
) {
  const latestReviewByFingerprint = new Map<string, ImportParseAnomalyReview>();

  for (const review of reviewRows) {
    if (!latestReviewByFingerprint.has(review.anomaly_fingerprint)) {
      latestReviewByFingerprint.set(review.anomaly_fingerprint, review);
    }
  }

  return anomalies.map((anomaly) => {
    const review = latestReviewByFingerprint.get(anomaly.fingerprint);

    if (!review) {
      return anomaly;
    }

    return {
      ...anomaly,
      resolutionStatus: review.status,
      resolvedAt: review.resolved_at,
      reviewNote: review.note,
      reviewedAt: review.reviewed_at,
      reviewStatus: review.status
    };
  });
}

function calculateImpactScore({
  affectedEvents,
  detectedAt,
  loadedAt,
  severity
}: {
  affectedEvents: number;
  detectedAt: string;
  loadedAt: string;
  severity: "info" | "warning";
}) {
  const severityWeight = severity === "warning" ? 3 : 1.5;
  const ageMs = Math.max(0, new Date(loadedAt).getTime() - new Date(detectedAt).getTime());
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  const recencyFactor = Math.max(0.5, 1 - ageDays / 14);

  return Math.round(severityWeight * Math.max(1, affectedEvents) * recencyFactor);
}

function emptyWeeklyScorecard(): ImportParseWeeklyScorecard {
  return {
    accuracyDropAnomalies: 0,
    anomalyCount: 0,
    correctionSpikeAnomalies: 0,
    falsePositiveRatePct: null,
    meanTimeToResolutionHours: null,
    pendingAnomalies: 0,
    reviewedEvents: 0,
    reviewedAnomalies: 0,
    resolvedAnomalies: 0,
    totalImpactScore: 0
  };
}

function mapAnomalyEvent(event: ImportParseTrendEvent): ImportParseAnomalyEvent {
  return {
    confidence: event.confidence,
    createdAt: event.created_at,
    eventType: event.event_type,
    finalSegmentType: event.final_segment_type,
    id: event.id,
    parserName: event.parser_name,
    parserVersion: event.parser_version,
    predictedSegmentType: event.predicted_segment_type,
    sourceLabel: event.source_label,
    sourceType: event.source_type,
    unfiledItemId: event.unfiled_item_id
  };
}

function buildAccuracyTrend(events: ImportParseTrendEvent[]): ImportParseAccuracyTrend[] {
  const byBucket = new Map<
    string,
    {
      bucket: string;
      matchingEvents: number;
      parserName: string;
      parserVersion: string;
      reviewedEvents: number;
    }
  >();

  for (const event of events) {
    if (!reviewedEventTypes.has(event.event_type)) {
      continue;
    }

    const bucket = event.created_at.slice(0, 10);
    const key = `${bucket}:${event.parser_name}:${event.parser_version}`;
    const current =
      byBucket.get(key) ||
      {
        bucket,
        matchingEvents: 0,
        parserName: event.parser_name,
        parserVersion: event.parser_version,
        reviewedEvents: 0
      };

    if (event.predicted_segment_type && event.final_segment_type) {
      current.reviewedEvents += 1;

      if (event.predicted_segment_type === event.final_segment_type) {
        current.matchingEvents += 1;
      }
    }

    byBucket.set(key, current);
  }

  return Array.from(byBucket.values())
    .filter((row) => row.reviewedEvents > 0)
    .map((row) => ({
      ...row,
      segmentTypeAccuracyPct: percent(row.matchingEvents, row.reviewedEvents)
    }))
    .sort((a, b) =>
      a.bucket === b.bucket
        ? `${a.parserName}:${a.parserVersion}`.localeCompare(`${b.parserName}:${b.parserVersion}`)
        : a.bucket.localeCompare(b.bucket)
    );
}

function buildCorrectionBySegmentType(
  events: ImportParseTrendEvent[]
): ImportParseCorrectionBySegmentType[] {
  const bySegmentType = new Map<
    string,
    { corrections: number; reviewedEvents: number; segmentType: string }
  >();

  for (const event of events) {
    if (!reviewedEventTypes.has(event.event_type)) {
      continue;
    }

    const segmentType =
      event.final_segment_type || event.predicted_segment_type || "unknown";
    const current =
      bySegmentType.get(segmentType) || {
        corrections: 0,
        reviewedEvents: 0,
        segmentType
      };

    current.reviewedEvents += 1;

    if (event.event_type === "correction") {
      current.corrections += 1;
    }

    bySegmentType.set(segmentType, current);
  }

  return Array.from(bySegmentType.values())
    .map((row) => ({
      ...row,
      correctionRatePct: percent(row.corrections, row.reviewedEvents)
    }))
    .sort((a, b) => b.reviewedEvents - a.reviewedEvents || a.segmentType.localeCompare(b.segmentType));
}

function percent(numerator: number, denominator: number) {
  if (!denominator) {
    return null;
  }

  return Number(((numerator / denominator) * 100).toFixed(2));
}

function formatNumber(value: number | null) {
  return value == null ? "0" : value.toFixed(2).replace(/\.00$/, "");
}
