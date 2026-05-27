#!/usr/bin/env bash
set -euo pipefail

message="${1:-Flight Ops pipeline event}"

if [ -z "${SLACK_WEBHOOK_URL:-}" ] && [ -z "${TEAMS_WEBHOOK_URL:-}" ]; then
  echo "$message"
  exit 0
fi

if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
  curl -fsS \
    -X POST \
    -H "Content-Type: application/json" \
    --data "{\"text\":\"${message}\"}" \
    "$SLACK_WEBHOOK_URL"
fi

if [ -n "${TEAMS_WEBHOOK_URL:-}" ]; then
  curl -fsS \
    -X POST \
    -H "Content-Type: application/json" \
    --data "{\"@type\":\"MessageCard\",\"@context\":\"https://schema.org/extensions\",\"summary\":\"Flight Ops\",\"themeColor\":\"2563EB\",\"title\":\"Flight Ops\",\"text\":\"${message}\"}" \
    "$TEAMS_WEBHOOK_URL"
fi
