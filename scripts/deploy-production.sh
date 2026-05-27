#!/usr/bin/env bash
set -euo pipefail

namespace="${KUBE_NAMESPACE:-flight-ops}"
release="${HELM_RELEASE_NAME:-unified-alerts-dashboard}"
chart="${HELM_CHART_PATH:-deploy/helm/unified-alerts-dashboard}"
image_repository="${IMAGE_REPOSITORY:-ghcr.io/your-org/flight-ops-alerts-dashboard}"
image_tag="${IMAGE_TAG:-${GITHUB_SHA:-latest}}"
dashboard_secret="${DASHBOARD_SECRET_NAME:-flight-ops-alerts-dashboard}"

if [ -n "${KUBE_CONFIG_DATA:-}" ]; then
  mkdir -p "$HOME/.kube"
  echo "$KUBE_CONFIG_DATA" | base64 --decode > "$HOME/.kube/config"
fi

if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
  kubectl -n "$namespace" create secret generic slack-webhook-url \
    --from-literal=address="$SLACK_WEBHOOK_URL" \
    --dry-run=client \
    -o yaml \
    | kubectl apply -f -
fi

if [ -n "${PAGERDUTY_ROUTING_KEY:-}" ]; then
  kubectl -n "$namespace" create secret generic pagerduty-routing-key \
    --from-literal=routingKey="$PAGERDUTY_ROUTING_KEY" \
    --dry-run=client \
    -o yaml \
    | kubectl apply -f -
fi

if [ -n "${GRAFANA_URL:-}" ] && [ -n "${GRAFANA_SERVICE_ACCOUNT_TOKEN:-}" ]; then
  kubectl -n "$namespace" create secret generic "$dashboard_secret" \
    --from-literal=GRAFANA_URL="$GRAFANA_URL" \
    --from-literal=GRAFANA_SERVICE_ACCOUNT_TOKEN="$GRAFANA_SERVICE_ACCOUNT_TOKEN" \
    --from-literal=SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}" \
    --from-literal=TEAMS_WEBHOOK_URL="${TEAMS_WEBHOOK_URL:-}" \
    --from-literal=DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}" \
    --from-literal=PAGERDUTY_ROUTING_KEY="${PAGERDUTY_ROUTING_KEY:-}" \
    --dry-run=client \
    -o yaml \
    | kubectl apply -f -
else
  echo "GRAFANA_URL and GRAFANA_SERVICE_ACCOUNT_TOKEN are not set; expecting dashboard secret ${dashboard_secret} to exist."
fi

if [ "${SKIP_HELM_DEPLOY:-false}" != "true" ]; then
  helm upgrade --install "$release" "$chart" \
    --namespace "$namespace" \
    --create-namespace \
    --set image.repository="$image_repository" \
    --set image.tag="$image_tag" \
    --set secrets.create=false \
    --set secrets.name="$dashboard_secret" \
    --wait \
    --timeout 5m
else
  echo "SKIP_HELM_DEPLOY=true; applying secrets and Flagger resources only."
fi

kubectl apply -n "$namespace" -f deploy/flagger/metrictemplates.yaml
kubectl apply -n "$namespace" -f deploy/flagger/unified-alerts-canary-runtime.yaml
kubectl apply -f deploy/autoscaling/prometheus-adapter-config.yaml
kubectl apply -f deploy/autoscaling/istio-ingressgateway-hpa.yaml
kubectl apply -f deploy/autoscaling/cluster-autoscaler-notes.yaml
kubectl apply -f deploy/prometheus/hpa-alerts.yaml
if [ "${APPLY_VPA_RECOMMENDER:-false}" = "true" ]; then
  kubectl apply -f deploy/vpa/unified-alerts-dashboard-recommender.yaml
fi
if [ "${APPLY_ALB_INGRESS:-false}" = "true" ]; then
  kubectl apply -f deploy/ingress/unified-alerts-alb.yaml
fi
kubectl -n "$namespace" rollout status "deployment/${release}" --timeout=5m
