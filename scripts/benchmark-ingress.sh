#!/usr/bin/env bash
set -euo pipefail

ISTIO_URL="${ISTIO_URL:-}"
ALB_URL="${ALB_URL:-}"
DURATION="${DURATION:-2m}"
VUS="${VUS:-20}"
RESULT_DIR="${RESULT_DIR:-benchmark-results}"
K6_BIN="${K6_BIN:-k6}"

if [[ -z "${ISTIO_URL}" || -z "${ALB_URL}" ]]; then
  cat <<EOF
Usage:
  ISTIO_URL=https://istio.example.com/flight-ops/alerts \\
  ALB_URL=https://alb.example.com/flight-ops/alerts \\
  DURATION=2m VUS=20 $0
EOF
  exit 1
fi

if ! command -v "${K6_BIN}" >/dev/null 2>&1; then
  echo "Missing k6 binary. Install k6 or set K6_BIN=/path/to/k6." >&2
  exit 1
fi

mkdir -p "${RESULT_DIR}"

run_target() {
  local name="$1"
  local url="$2"
  local out="${RESULT_DIR}/${name}.json"

  echo "Benchmarking ${name}: ${url}"
  "${K6_BIN}" run \
    --vus "${VUS}" \
    --duration "${DURATION}" \
    --summary-export "${out}" \
    -e TARGET_URL="${url}" \
    - <<'EOF'
import http from "k6/http";
import { sleep } from "k6";

export const options = {
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

export default function () {
  http.get(__ENV.TARGET_URL, {
    headers: {
      "x-flight-ops-benchmark": "ingress",
    },
  });
  sleep(1);
}
EOF
}

run_target "istio" "${ISTIO_URL}"
run_target "alb" "${ALB_URL}"

cat <<EOF

Benchmark complete.
Raw k6 summaries:
  ${RESULT_DIR}/istio.json
  ${RESULT_DIR}/alb.json

Copy p50/p95/p99 and failure rate into:
  docs/ops/istio-vs-alb-benchmark-results.md
EOF
