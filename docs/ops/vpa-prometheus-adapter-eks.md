# VPA, HPA, and Prometheus Adapter on EKS

This stack keeps HPA as the active scaler and uses VPA only when explicitly
enabled. In production, the safest default is:

- HPA scales replicas from CPU, memory, and Prometheus Adapter pod metrics.
- VPA is disabled by default to reduce control-loop churn and recommender cost.
- Cluster Autoscaler adds nodes when HPA-created pods cannot schedule.

## Production Apply

```bash
kubectl apply -f deploy/autoscaling/unified-alerts-hpa-vpa-prom-adapter.yaml
```

The bundle includes:

- Prometheus Adapter rules for `http_requests_rps`.
- Prometheus Adapter rules for `alert_feed_queue_depth`.
- HPA pod metric targets for the dashboard.
- VPA in `Off` mode for recommendations only.

## Disable VPA Recommendation Mode

Use the Helm overlay when you want the least expensive runtime path:

```bash
helm upgrade --install unified-alerts-dashboard \
  deploy/helm/unified-alerts-dashboard \
  -n flight-ops \
  -f deploy/helm/unified-alerts-dashboard/values-prod.yaml \
  -f deploy/vpa/values-disable-vpa.yaml
```

The overlay renders no VPA object. That avoids VPA recommender work for this
deployment and leaves HPA plus Cluster Autoscaler in full control.

## Fix Stuck HPA Metrics After Kubernetes Upgrade

Run the diagnostic first:

```bash
scripts/fix-hpa-stuck-metrics.sh
```

If the custom metrics API is registered but stale, apply the safe repair:

```bash
APPLY_FIXES=true scripts/fix-hpa-stuck-metrics.sh
```

If metrics are still unavailable, verify:

- `v1beta1.custom.metrics.k8s.io` APIService is available.
- HPA metric names match Prometheus Adapter output exactly.
- The adapter PromQL returns `namespace` and `pod` labels.
- The adapter can reach Prometheus after the cluster upgrade.
- The HPA object references the current deployment name.
