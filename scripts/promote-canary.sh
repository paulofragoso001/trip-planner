#!/usr/bin/env bash
set -euo pipefail

namespace="${KUBE_NAMESPACE:-flight-ops}"

if [ -n "${KUBE_CONFIG_DATA:-}" ]; then
  mkdir -p "$HOME/.kube"
  echo "$KUBE_CONFIG_DATA" | base64 --decode > "$HOME/.kube/config"
fi

if [ -n "${PROMOTE_HOOK_URL:-}" ]; then
  curl -fsS -X POST "$PROMOTE_HOOK_URL"
  exit 0
fi

kubectl -n "$namespace" annotate canary flight-ops \
  "flight-ops.wayline.dev/promoted-by=github-actions" \
  "flight-ops.wayline.dev/promoted-at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --overwrite
kubectl -n "$namespace" get canary flight-ops
