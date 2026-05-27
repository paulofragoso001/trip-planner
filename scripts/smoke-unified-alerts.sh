#!/usr/bin/env bash
set -euo pipefail

base_url="${UNIFIED_ALERTS_BASE_URL:-}"

if [ -z "$base_url" ]; then
  echo "UNIFIED_ALERTS_BASE_URL is not set; skipping external smoke."
  exit 0
fi

base_url="${base_url%/}"

curl -fsS "$base_url/flight-ops/alerts" >/dev/null
curl -fsS "$base_url/api/alerts" >/dev/null
curl -fsS "$base_url/api/metrics" | grep -q "flight_ops_alert_dashboard"
