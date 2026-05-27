#!/usr/bin/env bash
set -euo pipefail

# Daily validation uses the same rollback criteria as the canary gate. Override
# PROMETHEUS_CANARY_APP/PROMETHEUS_PRIMARY_APP to point at stable targets.
exec bash scripts/check-canary-promql.sh
