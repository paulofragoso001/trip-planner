#!/usr/bin/env bash
set -euo pipefail

message="${1:-Unified alerts deployment event}"

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
    --data "{\"@type\":\"MessageCard\",\"@context\":\"https://schema.org/extensions\",\"summary\":\"Unified Alerts\",\"themeColor\":\"2563EB\",\"title\":\"Unified Alerts\",\"text\":\"${message}\"}" \
    "$TEAMS_WEBHOOK_URL"
fi

if [ -n "${DISCORD_WEBHOOK_URL:-}" ]; then
  curl -fsS \
    -X POST \
    -H "Content-Type: application/json" \
    --data "{\"content\":\"${message}\"}" \
    "$DISCORD_WEBHOOK_URL"
fi

if [ -z "${SLACK_WEBHOOK_URL:-}" ] && [ -z "${TEAMS_WEBHOOK_URL:-}" ] && [ -z "${DISCORD_WEBHOOK_URL:-}" ]; then
  echo "$message"
fi
