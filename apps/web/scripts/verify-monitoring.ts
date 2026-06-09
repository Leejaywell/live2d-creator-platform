import { readFileSync } from "node:fs";

import { requiredProductionMonitoringAlerts } from "../src/lib/monitoring-evidence";

const rulesPath = "monitoring/prometheus-rules.yml";
const scrapePath = "monitoring/prometheus-scrape.example.yml";
const rulesContent = readFileSync(rulesPath, "utf8");
const scrapeContent = readFileSync(scrapePath, "utf8");

const requiredSignals = [
  "up{job=\"live2d-web\"}",
  "probe_success{job=\"live2d-health-full\"}",
  "live2d_http_requests_total",
  "live2d_http_request_duration_seconds_bucket",
  "live2d_rate_limit_rejections_total",
  "live2d_csp_violations_total",
];

const failures = [
  ...requiredProductionMonitoringAlerts.filter((alert) => !rulesContent.includes(`alert: ${alert}`)).map((alert) => `Missing alert ${alert}`),
  ...requiredSignals.filter((signal) => !rulesContent.includes(signal)).map((signal) => `Missing signal ${signal}`),
];

const requiredScrapeSnippets = [
  "job_name: live2d-web",
  "metrics_path: /api/metrics",
  "bearer_token_file: /etc/prometheus/secrets/live2d_metrics_bearer_token",
  "job_name: live2d-health-full",
  "metrics_path: /probe",
  "https://your-domain.example/api/health?mode=full",
  "blackbox-exporter:9115",
];

for (const snippet of requiredScrapeSnippets) {
  if (!scrapeContent.includes(snippet)) {
    failures.push(`Scrape config is missing ${snippet}`);
  }
}

if (rulesContent.includes("\t") || scrapeContent.includes("\t")) {
  failures.push("YAML file must not contain tab indentation");
}

if (!rulesContent.startsWith("groups:\n")) {
  failures.push("Prometheus rules file must start with groups");
}

if (!scrapeContent.startsWith("scrape_configs:\n")) {
  failures.push("Prometheus scrape example must start with scrape_configs");
}

const report = {
  ok: failures.length === 0,
  files: {
    rules: rulesPath,
    scrape: scrapePath,
  },
  alerts: requiredProductionMonitoringAlerts,
  signals: requiredSignals,
  scrapeSnippets: requiredScrapeSnippets,
  failures,
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) {
  process.exitCode = 1;
}
