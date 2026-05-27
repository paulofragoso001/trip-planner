#!/usr/bin/env bash
set -euo pipefail

namespace="${KUBE_NAMESPACE:-flight-ops}"
canary_app="${PROMETHEUS_CANARY_APP:-flight-ops-canary}"
primary_app="${PROMETHEUS_PRIMARY_APP:-flight-ops-primary}"
max_error_rate="${PROMETHEUS_MAX_ERROR_RATE:-0.02}"
max_latency_ratio="${PROMETHEUS_MAX_LATENCY_RATIO:-1.25}"
max_marker_staleness_seconds="${PROMETHEUS_MAX_MARKER_STALENESS_SECONDS:-90}"
max_smoke_failures="${PROMETHEUS_MAX_SMOKE_FAILURES:-0}"

if [ -n "${KUBE_CONFIG_DATA:-}" ]; then
  mkdir -p "$HOME/.kube"
  echo "$KUBE_CONFIG_DATA" | base64 --decode > "$HOME/.kube/config"
fi

if command -v kubectl >/dev/null 2>&1; then
  kubectl -n "$namespace" wait canary/flight-ops --for=condition=Promoted --timeout=15m || {
    kubectl -n "$namespace" describe canary flight-ops || true
    exit 1
  }
fi

if [ -z "${PROMETHEUS_BASE_URL:-}" ]; then
  echo "PROMETHEUS_BASE_URL is not set; Flagger status is the canary analysis gate."
  exit 0
fi

query_prometheus() {
  local query="$1"
  curl -fsS --get "$PROMETHEUS_BASE_URL/api/v1/query" --data-urlencode "query=$query" \
    | node -e 'let raw=""; process.stdin.on("data", c => raw += c); process.stdin.on("end", () => { const json = JSON.parse(raw); const value = Number(json?.data?.result?.[0]?.value?.[1] ?? 0); console.log(Number.isFinite(value) ? value : 0); });'
}

assert_max() {
  local name="$1"
  local value="$2"
  local max="$3"
  echo "${name}=${value} max=${max}"
  node -e "const value=Number(process.argv[1]); const max=Number(process.argv[2]); if (value > max) process.exit(1)" "$value" "$max"
}

canary_latency_query="histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{app=\"${canary_app}\"}[2m])) by (le))"
primary_latency_query="histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{app=\"${primary_app}\"}[2m])) by (le))"
error_rate_query="sum(rate(http_requests_total{app=\"${canary_app}\",status=~\"5..\"}[5m])) / clamp_min(sum(rate(http_requests_total{app=\"${canary_app}\"}[5m])), 1)"
marker_staleness_query="time() - max(last_flight_marker_update_timestamp_seconds{app=\"${canary_app}\"})"
smoke_failure_query="sum(increase(flight_ops_smoke_fail_total{app=\"${canary_app}\"}[10m]))"

canary_latency="$(query_prometheus "$canary_latency_query")"
primary_latency="$(query_prometheus "$primary_latency_query")"
latency_ratio="$(node -e "const c=Number(process.argv[1]); const p=Number(process.argv[2]); console.log(p > 0 ? c / p : 0)" "$canary_latency" "$primary_latency")"
error_rate="$(query_prometheus "$error_rate_query")"
marker_staleness="$(query_prometheus "$marker_staleness_query")"
smoke_failures="$(query_prometheus "$smoke_failure_query")"

assert_max "p95_latency_ratio" "$latency_ratio" "$max_latency_ratio"
assert_max "5xx_error_rate" "$error_rate" "$max_error_rate"
assert_max "marker_staleness_seconds" "$marker_staleness" "$max_marker_staleness_seconds"
assert_max "smoke_test_failures" "$smoke_failures" "$max_smoke_failures"
