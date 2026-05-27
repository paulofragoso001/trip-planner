#!/usr/bin/env bash
set -euo pipefail

namespace="${KUBE_NAMESPACE:-flight-ops}"

if [ -n "${KUBE_CONFIG_DATA:-}" ]; then
  mkdir -p "$HOME/.kube"
  echo "$KUBE_CONFIG_DATA" | base64 --decode > "$HOME/.kube/config"
fi

chat_webhook="${FLIGHT_OPS_CHAT_WEBHOOK:-${SLACK_WEBHOOK_URL:-}}"

if [ -n "$chat_webhook" ]; then
  kubectl -n "$namespace" create secret generic flight-ops-chat-url \
    --from-literal=address="$chat_webhook" \
    --dry-run=client \
    -o yaml \
    | kubectl apply -f -
else
  echo "FLIGHT_OPS_CHAT_WEBHOOK or SLACK_WEBHOOK_URL is not set; flight-ops-chat-url must exist before Flagger can post alerts."
fi

if [ -n "${PAGERDUTY_ROUTING_KEY:-}" ]; then
  kubectl -n "$namespace" create secret generic flight-ops-pagerduty-key \
    --from-literal=routingKey="$PAGERDUTY_ROUTING_KEY" \
    --dry-run=client \
    -o yaml \
    | kubectl apply -f -
else
  echo "PAGERDUTY_ROUTING_KEY is not set; flight-ops-pagerduty-key must exist before critical paging works."
fi

kubectl apply -n "$namespace" -f deploy/flagger/alertprovider-chat.yaml
kubectl apply -n "$namespace" -f deploy/flagger/alertprovider-pagerduty.yaml
kubectl apply -n "$namespace" -f deploy/flagger/metrictemplates.yaml
kubectl apply -n "$namespace" -f deploy/flagger/canary.yaml
kubectl -n "$namespace" get canary flight-ops
