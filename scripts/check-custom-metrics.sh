#!/usr/bin/env bash
set -euo pipefail

namespace="${KUBE_NAMESPACE:-flight-ops}"

if [ -n "${KUBE_CONFIG_DATA:-}" ]; then
  mkdir -p "$HOME/.kube"
  echo "$KUBE_CONFIG_DATA" | base64 --decode > "$HOME/.kube/config"
fi

kubectl get --raw /apis/custom.metrics.k8s.io/v1beta1 >/tmp/custom-metrics-api.json
kubectl get --raw "/apis/custom.metrics.k8s.io/v1beta1/namespaces/${namespace}/pods/*/http_requests_rps" >/tmp/http-requests-rps.json
kubectl get --raw "/apis/custom.metrics.k8s.io/v1beta1/namespaces/${namespace}/pods/*/alert_feed_queue_depth" >/tmp/alert-feed-queue-depth.json

node -e '
const fs = require("fs");
for (const file of ["/tmp/custom-metrics-api.json", "/tmp/http-requests-rps.json", "/tmp/alert-feed-queue-depth.json"]) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!json) process.exit(1);
  console.log(`${file}: ok`);
}
'
