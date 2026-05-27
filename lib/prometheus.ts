type LabelValues = Record<string, string | number | boolean | null | undefined>;

type MetricConfig = {
  name: string;
  help: string;
  labelNames?: string[];
};

type HistogramConfig = MetricConfig & {
  buckets: number[];
};

class MetricsRegistry {
  readonly contentType = "text/plain; version=0.0.4; charset=utf-8";
  private metricList: BaseMetric[] = [];
  private startedAt = Date.now();

  register(metric: BaseMetric) {
    if (this.metricList.some((current) => current.name === metric.name)) {
      return;
    }

    this.metricList.push(metric);
  }

  async metricsText() {
    const uptimeSeconds = Math.max(0, (Date.now() - this.startedAt) / 1000);
    const defaultMetrics = [
      "# HELP flight_refresh_process_uptime_seconds Process uptime in seconds",
      "# TYPE flight_refresh_process_uptime_seconds gauge",
      `flight_refresh_process_uptime_seconds ${uptimeSeconds}`
    ];

    return [...defaultMetrics, ...this.metricList.map((metric) => metric.render())]
      .filter(Boolean)
      .join("\n\n") + "\n";
  }

  metrics() {
    return this.metricsText();
  }
}

class BaseMetric {
  readonly name: string;
  protected readonly help: string;
  protected readonly labelNames: string[];

  constructor(config: MetricConfig) {
    this.name = config.name;
    this.help = config.help;
    this.labelNames = config.labelNames || [];
  }

  protected labelKey(labels: LabelValues = {}) {
    return this.labelNames.map((name) => `${name}:${String(labels[name] ?? "")}`).join("|");
  }

  protected formatLabels(key: string) {
    if (!key) return "";

    const pairs = key
      .split("|")
      .map((pair) => {
        const [name, ...valueParts] = pair.split(":");
        const value = valueParts.join(":").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        return `${name}="${value}"`;
      })
      .join(",");

    return `{${pairs}}`;
  }

  protected header(type: "counter" | "gauge" | "histogram") {
    return [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} ${type}`];
  }

  render(): string {
    return "";
  }
}

class CounterMetric extends BaseMetric {
  private values = new Map<string, number>();

  inc(labels?: LabelValues, value = 1) {
    const key = this.labelKey(labels);
    this.values.set(key, (this.values.get(key) || 0) + value);
  }

  render() {
    return [
      ...this.header("counter"),
      ...Array.from(this.values.entries()).map(
        ([key, value]) => `${this.name}${this.formatLabels(key)} ${value}`
      )
    ].join("\n");
  }
}

class GaugeMetric extends BaseMetric {
  private values = new Map<string, number>();

  set(labels: LabelValues | number, value?: number) {
    if (typeof labels === "number") {
      this.values.set("", labels);
      return;
    }

    this.values.set(this.labelKey(labels), value ?? 0);
  }

  inc(labels?: LabelValues, value = 1) {
    const key = this.labelKey(labels);
    this.values.set(key, (this.values.get(key) || 0) + value);
  }

  dec(labels?: LabelValues, value = 1) {
    this.inc(labels, -value);
  }

  render() {
    return [
      ...this.header("gauge"),
      ...Array.from(this.values.entries()).map(
        ([key, value]) => `${this.name}${this.formatLabels(key)} ${value}`
      )
    ].join("\n");
  }
}

class HistogramMetric extends BaseMetric {
  private readonly buckets: number[];
  private values = new Map<string, { count: number; sum: number; buckets: Map<number, number> }>();

  constructor(config: HistogramConfig) {
    super(config);
    this.buckets = [...config.buckets].sort((first, second) => first - second);
  }

  observe(labels: LabelValues, value: number) {
    const key = this.labelKey(labels);
    const current = this.values.get(key) || {
      count: 0,
      sum: 0,
      buckets: new Map(this.buckets.map((bucket) => [bucket, 0]))
    };

    current.count += 1;
    current.sum += value;
    this.buckets.forEach((bucket) => {
      if (value <= bucket) {
        current.buckets.set(bucket, (current.buckets.get(bucket) || 0) + 1);
      }
    });
    this.values.set(key, current);
  }

  startTimer(labels: LabelValues) {
    const startedAt = Date.now();
    return (extraLabels: LabelValues = {}) => {
      this.observe({ ...labels, ...extraLabels }, (Date.now() - startedAt) / 1000);
    };
  }

  render() {
    const lines = this.header("histogram");

    this.values.forEach((value, key) => {
      this.buckets.forEach((bucket) => {
        lines.push(
          `${this.name}_bucket${this.formatLabelsWithExtra(key, { le: String(bucket) })} ${value.buckets.get(bucket) || 0}`
        );
      });
      lines.push(
        `${this.name}_bucket${this.formatLabelsWithExtra(key, { le: "+Inf" })} ${value.count}`
      );
      lines.push(`${this.name}_sum${this.formatLabels(key)} ${value.sum}`);
      lines.push(`${this.name}_count${this.formatLabels(key)} ${value.count}`);
    });

    return lines.join("\n");
  }

  private formatLabelsWithExtra(key: string, extra: Record<string, string>) {
    const labels = this.formatLabels(key);
    const extraPairs = Object.entries(extra)
      .map(([name, value]) => `${name}="${value}"`)
      .join(",");

    if (!labels) return `{${extraPairs}}`;
    return labels.replace(/}$/, `,${extraPairs}}`);
  }
}

export const register = new MetricsRegistry();

export const workerJobsTotal = new CounterMetric({
  name: "flight_refresh_worker_jobs_total",
  help: "Total jobs processed by the flight refresh worker",
  labelNames: ["queue", "status"]
});

export const workerJobDurationSeconds = new HistogramMetric({
  name: "flight_refresh_worker_job_duration_seconds",
  help: "Job execution duration in seconds",
  labelNames: ["queue", "job_name", "status"],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60]
});

export const workerActiveJobs = new GaugeMetric({
  name: "flight_refresh_worker_active_jobs",
  help: "Number of active jobs currently being processed",
  labelNames: ["queue"]
});

export const workerQueuedJobs = new GaugeMetric({
  name: "flight_refresh_worker_queued_jobs",
  help: "Number of jobs waiting in the queue",
  labelNames: ["queue"]
});

export const workerFailedJobs = new GaugeMetric({
  name: "flight_refresh_worker_failed_jobs",
  help: "Number of failed jobs in the queue",
  labelNames: ["queue"]
});

export const workerStalledJobs = new CounterMetric({
  name: "flight_refresh_worker_stalled_jobs_total",
  help: "Total stalled jobs observed by the monitor",
  labelNames: ["queue"]
});

export const workerRetriesTotal = new CounterMetric({
  name: "flight_refresh_worker_retries_total",
  help: "Total retries triggered by the monitor or worker",
  labelNames: ["queue", "reason"]
});

export const workerQueueHealth = new GaugeMetric({
  name: "flight_refresh_queue_health",
  help: "Queue health as 1 for healthy and 0 for degraded",
  labelNames: ["queue"]
});

export const alertDashboardAlertsTotal = new GaugeMetric({
  name: "flight_ops_alert_dashboard_alerts",
  help: "Current alert count in the Flight Ops unified alert dashboard",
  labelNames: ["source", "severity", "status"]
});

export const alertDashboardPagerDutyIncidents = new GaugeMetric({
  name: "flight_ops_alert_dashboard_pagerduty_incidents",
  help: "Current PagerDuty incident count by alert status",
  labelNames: ["status"]
});

export const alertDashboardAckTotal = new CounterMetric({
  name: "flight_ops_alert_dashboard_ack_total",
  help: "Total alert acknowledgements observed by the Flight Ops dashboard",
  labelNames: ["source", "severity"]
});

export const dashboardRequestsTotal = new CounterMetric({
  name: "dashboard_requests_total",
  help: "Total unified alerts dashboard requests by route and method",
  labelNames: ["route", "method"]
});

export const httpRequestsTotal = new CounterMetric({
  name: "http_requests_total",
  help: "Total HTTP requests for custom HPA metrics",
  labelNames: ["app", "route", "method", "status"]
});

export const alertFeedQueueDepth = new GaugeMetric({
  name: "alert_feed_queue_depth",
  help: "Current alert feed backlog depth for HPA custom metrics",
  labelNames: ["app", "source"]
});

[
  workerJobsTotal,
  workerJobDurationSeconds,
  workerActiveJobs,
  workerQueuedJobs,
  workerFailedJobs,
  workerStalledJobs,
  workerRetriesTotal,
  workerQueueHealth,
  alertDashboardAlertsTotal,
  alertDashboardPagerDutyIncidents,
  alertDashboardAckTotal,
  dashboardRequestsTotal,
  httpRequestsTotal,
  alertFeedQueueDepth
].forEach((metric) => register.register(metric));

export function recordJobStart(jobName: string) {
  workerJobsTotal.inc({ queue: "flight-refresh", status: "started" });
  return workerJobDurationSeconds.startTimer({
    queue: "flight-refresh",
    job_name: jobName,
    status: "completed"
  });
}

export type AlertMetricsInput = {
  source: string;
  severity: string;
  status: string;
};

export function recordAlertDashboardSnapshot(alerts: AlertMetricsInput[]) {
  const counts = new Map<string, number>();
  const pagerDutyCounts = new Map<string, number>();
  const queueDepthBySource = new Map<string, number>();

  alerts.forEach((alert) => {
    const key = `${alert.source}|${alert.severity}|${alert.status}`;
    counts.set(key, (counts.get(key) || 0) + 1);

    if (alert.source === "pagerduty") {
      pagerDutyCounts.set(alert.status, (pagerDutyCounts.get(alert.status) || 0) + 1);
    }

    if (alert.status === "firing") {
      queueDepthBySource.set(alert.source, (queueDepthBySource.get(alert.source) || 0) + 1);
    }
  });

  counts.forEach((count, key) => {
    const [source, severity, status] = key.split("|");
    alertDashboardAlertsTotal.set({ source, severity, status }, count);
  });

  pagerDutyCounts.forEach((count, status) => {
    alertDashboardPagerDutyIncidents.set({ status }, count);
  });

  queueDepthBySource.forEach((count, source) => {
    alertFeedQueueDepth.set({ app: "unified-alerts-dashboard", source }, count);
  });
}

export function recordAlertAck(source: string, severity: string) {
  alertDashboardAckTotal.inc({ source, severity });
}

export function recordDashboardRequest(route: string, method: string) {
  dashboardRequestsTotal.inc({ route, method });
  httpRequestsTotal.inc({
    app: "unified-alerts-dashboard",
    method,
    route,
    status: "200"
  });
}
