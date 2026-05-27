#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-flight-ops}"
HPA_NAME="${HPA_NAME:-unified-alerts-dashboard}"
ADAPTER_NAMESPACE="${ADAPTER_NAMESPACE:-monitoring}"
ADAPTER_DEPLOYMENT="${ADAPTER_DEPLOYMENT:-prometheus-adapter}"
APPLY_FIXES="${APPLY_FIXES:-false}"

echo "Checking custom-metrics API registration..."
kubectl get apiservice v1beta1.custom.metrics.k8s.io -o wide

echo
echo "Checking HPA status and recent events..."
kubectl -n "${NAMESPACE}" describe hpa "${HPA_NAME}"

echo
echo "Checking expected custom metrics..."
kubectl get --raw "/apis/custom.metrics.k8s.io/v1beta1/namespaces/${NAMESPACE}/pods/*/http_requests_rps" || true
echo
kubectl get --raw "/apis/custom.metrics.k8s.io/v1beta1/namespaces/${NAMESPACE}/pods/*/alert_feed_queue_depth" || true
echo

echo "Checking Prometheus Adapter deployment..."
kubectl -n "${ADAPTER_NAMESPACE}" get deploy "${ADAPTER_DEPLOYMENT}" -o wide
kubectl -n "${ADAPTER_NAMESPACE}" logs "deploy/${ADAPTER_DEPLOYMENT}" --tail=80 || true

if [[ "${APPLY_FIXES}" != "true" ]]; then
  cat <<EOF

Dry run complete. To apply safe repairs, rerun with:

  APPLY_FIXES=true $0

Safe repairs performed when enabled:
  - restart the Prometheus Adapter deployment
  - annotate the HPA to force controller resync

If metrics still fail after that, verify the adapter rule names and PromQL labels.
EOF
  exit 0
fi

echo
echo "Restarting Prometheus Adapter..."
kubectl -n "${ADAPTER_NAMESPACE}" rollout restart "deploy/${ADAPTER_DEPLOYMENT}"
kubectl -n "${ADAPTER_NAMESPACE}" rollout status "deploy/${ADAPTER_DEPLOYMENT}" --timeout=180s

echo
echo "Forcing HPA controller resync with an annotation..."
kubectl -n "${NAMESPACE}" annotate hpa "${HPA_NAME}" \
  autoscaling.flight-ops.dev/resynced-at="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --overwrite

echo
echo "Rechecking HPA metrics..."
kubectl -n "${NAMESPACE}" get hpa "${HPA_NAME}" -o wide
