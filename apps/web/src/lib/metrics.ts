type LabelValue = string | number | boolean | undefined;

type Counter = {
  help: string;
  labels: string[];
  values: Map<string, number>;
};

type Histogram = {
  help: string;
  labels: string[];
  buckets: number[];
  values: Map<string, HistogramValue>;
};

type HistogramValue = {
  sum: number;
  count: number;
  buckets: number[];
};

const globalForMetrics = globalThis as unknown as {
  metricsRegistry?: MetricsRegistry;
};

class MetricsRegistry {
  counters = new Map<string, Counter>();
  histograms = new Map<string, Histogram>();
}

function registry() {
  if (!globalForMetrics.metricsRegistry) {
    globalForMetrics.metricsRegistry = new MetricsRegistry();
  }
  return globalForMetrics.metricsRegistry;
}

export function incrementCounter(name: string, help: string, labels: Record<string, LabelValue> = {}, amount = 1) {
  const reg = registry();
  const labelNames = Object.keys(labels).sort();
  const counter = reg.counters.get(name) ?? {
    help,
    labels: labelNames,
    values: new Map<string, number>(),
  };
  counter.labels = unique([...counter.labels, ...labelNames]).sort();
  const key = labelKey(counter.labels, labels);
  counter.values.set(key, (counter.values.get(key) ?? 0) + amount);
  reg.counters.set(name, counter);
}

export function observeHistogram(
  name: string,
  help: string,
  value: number,
  labels: Record<string, LabelValue> = {},
  buckets = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
) {
  const reg = registry();
  const labelNames = Object.keys(labels).sort();
  const histogram = reg.histograms.get(name) ?? {
    help,
    labels: labelNames,
    buckets,
    values: new Map<string, HistogramValue>(),
  };
  histogram.labels = unique([...histogram.labels, ...labelNames]).sort();
  const key = labelKey(histogram.labels, labels);
  const item = histogram.values.get(key) ?? { sum: 0, count: 0, buckets: Array(histogram.buckets.length).fill(0) };
  item.sum += value;
  item.count += 1;
  histogram.buckets.forEach((bucket, index) => {
    if (value <= bucket) {
      item.buckets[index] += 1;
    }
  });
  histogram.values.set(key, item);
  reg.histograms.set(name, histogram);
}

export function recordApiRequest(input: {
  route: string;
  method: string;
  status: number;
  durationMs: number;
}) {
  const labels = {
    route: input.route,
    method: input.method,
    status: input.status,
  };
  incrementCounter("live2d_http_requests_total", "Total API requests.", labels);
  observeHistogram("live2d_http_request_duration_seconds", "API request duration in seconds.", input.durationMs / 1000, labels);
}

export function logEvent(level: "info" | "warn" | "error", event: string, data: Record<string, unknown> = {}) {
  const payload = {
    level,
    event,
    service: "live2d-creator-platform-web",
    timestamp: new Date().toISOString(),
    ...data,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function renderPrometheusMetrics() {
  const lines = [
    "# HELP live2d_process_uptime_seconds Process uptime in seconds.",
    "# TYPE live2d_process_uptime_seconds gauge",
    `live2d_process_uptime_seconds ${Math.round(process.uptime())}`,
  ];
  const reg = registry();

  for (const [name, counter] of reg.counters.entries()) {
    lines.push(`# HELP ${name} ${counter.help}`);
    lines.push(`# TYPE ${name} counter`);
    for (const [key, value] of counter.values.entries()) {
      lines.push(`${name}${formatLabels(counter.labels, key)} ${value}`);
    }
  }

  for (const [name, histogram] of reg.histograms.entries()) {
    lines.push(`# HELP ${name} ${histogram.help}`);
    lines.push(`# TYPE ${name} histogram`);
    for (const [key, value] of histogram.values.entries()) {
      const labels = parseLabelKey(histogram.labels, key);
      histogram.buckets.forEach((bucket, index) => {
        lines.push(`${name}_bucket${formatLabels([...histogram.labels, "le"], labelKey([...histogram.labels, "le"], { ...labels, le: bucket }))} ${value.buckets[index]}`);
      });
      lines.push(`${name}_bucket${formatLabels([...histogram.labels, "le"], labelKey([...histogram.labels, "le"], { ...labels, le: "+Inf" }))} ${value.count}`);
      lines.push(`${name}_sum${formatLabels(histogram.labels, key)} ${value.sum}`);
      lines.push(`${name}_count${formatLabels(histogram.labels, key)} ${value.count}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function labelKey(labels: string[], values: Record<string, LabelValue>) {
  return labels.map((label) => String(values[label] ?? "")).join("\u001f");
}

function parseLabelKey(labels: string[], key: string) {
  const parts = key.split("\u001f");
  return Object.fromEntries(labels.map((label, index) => [label, parts[index] ?? ""]));
}

function formatLabels(labels: string[], key: string) {
  if (!labels.length) return "";
  const values = key.split("\u001f");
  return `{${labels.map((label, index) => `${label}="${escapeLabel(values[index] ?? "")}"`).join(",")}}`;
}

function escapeLabel(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"');
}

function unique(values: string[]) {
  return [...new Set(values)];
}
