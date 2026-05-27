# Istio Gateway vs ALB Benchmark Results

Use `scripts/benchmark-ingress.sh` to generate real latency numbers from the same
workload profile against both ingress paths. Do not promote benchmark numbers from
another cluster; Istio policy, Envoy filters, ALB target mode, node placement, TLS,
and pod readiness all change the result.

The script expects the `k6` CLI to be installed locally or available through
`K6_BIN=/path/to/k6`.

## Test Command

```bash
ISTIO_URL=https://alerts.example.com/flight-ops/alerts \
ALB_URL=https://alerts-alb.example.com/flight-ops/alerts \
DURATION=2m \
VUS=20 \
scripts/benchmark-ingress.sh
```

## Results Template

| Date | Cluster | Path | VUs | Duration | p50 | p95 | p99 | Failure rate | Notes |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
| TBD | flight-ops-eks | Istio Gateway | 20 | 2m | TBD | TBD | TBD | TBD | Gateway + VirtualService |
| TBD | flight-ops-eks | ALB target-type ip | 20 | 2m | TBD | TBD | TBD | TBD | Direct pod IP target |

## Decision Rule

Use ALB for the public dashboard path if latency is the only deciding factor.
Use Istio when canary routing, mesh telemetry, mTLS policy, retries, or traffic
splitting are more important than the lowest possible ingress overhead.

## Prometheus Cross-Check

```promql
histogram_quantile(
  0.95,
  sum(rate(http_request_duration_seconds_bucket{app="unified-alerts-dashboard"}[5m])) by (le, ingress)
)
```

```promql
sum(rate(http_requests_total{app="unified-alerts-dashboard",status=~"5.."}[5m])) by (ingress)
/
sum(rate(http_requests_total{app="unified-alerts-dashboard"}[5m])) by (ingress)
```
