# HPA, Cluster Autoscaler, and Ingress Troubleshooting

## Custom HPA Metrics

Start with the custom-metrics API before tuning the HPA.

```bash
kubectl get --raw /apis/custom.metrics.k8s.io/v1beta1 | jq
kubectl get --raw "/apis/custom.metrics.k8s.io/v1beta1/namespaces/flight-ops/pods/*/http_requests_rps" | jq
kubectl get --raw "/apis/custom.metrics.k8s.io/v1beta1/namespaces/flight-ops/pods/*/alert_feed_queue_depth" | jq
```

If the calls fail or return empty data:

- Confirm `prometheus-adapter` is running and registered.
- Confirm the HPA metric names match the adapter names exactly.
- Confirm Prometheus queries return data for the target pods.
- Confirm pod and namespace label overrides match the scraped series.
- Check HPA events for `FailedGetPodsMetric` or `FailedGetResourceMetric`.

After a Kubernetes upgrade, run the repair helper in dry-run mode first:

```bash
scripts/fix-hpa-stuck-metrics.sh
```

If the custom-metrics API is registered but the adapter is stale, apply the safe
adapter restart and HPA resync:

```bash
APPLY_FIXES=true scripts/fix-hpa-stuck-metrics.sh
```

Keep PromQL simple while debugging:

```promql
sum(rate(http_requests_total{app="unified-alerts-dashboard"}[2m])) by (pod, namespace)
max(alert_feed_queue_depth{app="unified-alerts-dashboard"}) by (pod, namespace)
```

## Istio Versus ALB

Use Istio when you need traffic splitting, mesh policy, retries, telemetry, or service-to-service routing controls.

Use ALB for the lightest public ingress path. ALB with `target-type: ip` can route directly to pod IPs and is a good latency baseline to compare against Istio under the same k6 profile.

Generate cluster-specific latency numbers with:

```bash
ISTIO_URL=https://alerts.example.com/flight-ops/alerts \
ALB_URL=https://alerts-alb.example.com/flight-ops/alerts \
scripts/benchmark-ingress.sh
```

## VPA With HPA And CA

Use this split:

- HPA controls replica count.
- VPA starts in recommendation mode.
- Cluster Autoscaler controls node count.

Avoid letting VPA mutate CPU or memory requests for the same workload while HPA is scaling on CPU or memory. That can create competing control loops.

## Cluster Autoscaler

Cost-aware defaults:

- `expander: least-waste`
- `balance-similar-node-groups: "true"`
- `scale-down-unneeded-time: 10m`
- `scale-down-delay-after-add: 10m`
- `scale-down-utilization-threshold: "0.5"`

Watch real traffic for at least a week before tightening scale-down windows further.

## Multi-Cluster

Keep HPA and Cluster Autoscaler local to each cluster. Federate metrics, logs, and traces into one observability plane, but let each cluster scale from its own live load.
