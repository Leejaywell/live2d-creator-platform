import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  buildProductionMonitoringEvidence,
  collectAlertmanagerResolvedAlertEvidence,
  parseProductionMonitoringAlertEvidence,
  type ProductionMonitoringAlertEvidence,
} from "../src/lib/monitoring-evidence-collection";
import { verifyProductionMonitoringEvidence } from "../src/lib/monitoring-evidence";

const args = process.argv.slice(2);

type PrometheusSample = {
  metric?: Record<string, string>;
  value?: [number, string];
};

async function main() {
  if (args.includes("--help")) {
    printHelp();
    return;
  }

  const deployBaseUrl = requiredValue(valueAfter("--deploy-base-url") ?? process.env.DEPLOY_BASE_URL, "DEPLOY_BASE_URL");
  const prometheusBaseUrl = requiredValue(valueAfter("--prometheus-url") ?? process.env.PROMETHEUS_BASE_URL, "PROMETHEUS_BASE_URL");
  const output = valueAfter("--output") ?? "artifacts/monitoring-production.json";
  const alertEvidence = await loadAlertEvidence();
  const client = new PrometheusClient(prometheusBaseUrl, process.env.PROMETHEUS_BEARER_TOKEN);

  const [metricsUpSamples, metricsSampleCountSamples, readinessProbeSamples] = await Promise.all([
    client.query('up{job="live2d-web"}'),
    client.query('count({job="live2d-web"})'),
    client.query('probe_success{job="live2d-health-full"}'),
  ]);

  const fullReadinessTarget = `${deployBaseUrl.replace(/\/$/, "")}/api/health?mode=full`;
  const readinessProbe = readinessProbeSamples.find((sample) => sample.metric?.instance === fullReadinessTarget) ?? readinessProbeSamples[0];
  const evidence = buildProductionMonitoringEvidence({
    checkedAt: new Date().toISOString(),
    deployBaseUrl,
    metricsJobUp: metricsUpSamples.some((sample) => numericSampleValue(sample) > 0),
    metricsSampleCount: numericSampleValue(metricsSampleCountSamples[0]) || metricsUpSamples.length,
    fullReadinessProbeSuccess: numericSampleValue(readinessProbe) > 0,
    fullReadinessProbeTarget: readinessProbe?.metric?.instance ?? fullReadinessTarget,
    alerts: alertEvidence,
  });

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);

  const report = verifyProductionMonitoringEvidence(output, { maxEvidenceAgeHours: numberAfter("--max-age-hours") ?? 24 });
  console.log(JSON.stringify({ output, evidence, verification: report }, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

class PrometheusClient {
  constructor(
    private readonly baseUrl: string,
    private readonly bearerToken: string | undefined,
  ) {}

  async query(query: string): Promise<PrometheusSample[]> {
    const url = new URL("/api/v1/query", this.baseUrl);
    url.searchParams.set("query", query);
    const response = await fetch(url, {
      headers: this.bearerToken ? { Authorization: `Bearer ${this.bearerToken}` } : undefined,
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Prometheus query failed (${response.status}) for ${query}: ${body.slice(0, 200)}`);
    }

    const parsed = JSON.parse(body) as unknown;
    if (!isRecord(parsed) || parsed.status !== "success" || !isRecord(parsed.data) || !Array.isArray(parsed.data.result)) {
      throw new Error(`Prometheus query returned an unexpected response for ${query}`);
    }
    return parsed.data.result as PrometheusSample[];
  }
}

class AlertmanagerClient {
  constructor(
    private readonly baseUrl: string,
    private readonly bearerToken: string | undefined,
  ) {}

  async resolvedAlerts() {
    const url = new URL("/api/v2/alerts", this.baseUrl);
    url.searchParams.set("active", "false");
    url.searchParams.set("silenced", "true");
    url.searchParams.set("inhibited", "true");
    url.searchParams.set("unprocessed", "true");
    const response = await fetch(url, {
      headers: this.bearerToken ? { Authorization: `Bearer ${this.bearerToken}` } : undefined,
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Alertmanager query failed (${response.status}): ${body.slice(0, 200)}`);
    }
    return JSON.parse(body) as unknown;
  }
}

async function loadAlertEvidence(): Promise<ProductionMonitoringAlertEvidence[]> {
  const path = valueAfter("--alert-evidence");
  const raw = path ? readFileSync(path, "utf8") : process.env.MONITORING_ALERTS_JSON;
  if (raw) {
    return parseProductionMonitoringAlertEvidence(JSON.parse(raw));
  }

  const alertmanagerBaseUrl = valueAfter("--alertmanager-url") ?? process.env.ALERTMANAGER_BASE_URL;
  if (!alertmanagerBaseUrl) {
    throw new Error("Provide alert evidence with --alert-evidence <path>, MONITORING_ALERTS_JSON, or ALERTMANAGER_BASE_URL");
  }

  const client = new AlertmanagerClient(alertmanagerBaseUrl, process.env.ALERTMANAGER_BEARER_TOKEN);
  return collectAlertmanagerResolvedAlertEvidence(await client.resolvedAlerts());
}

function numericSampleValue(sample: PrometheusSample | undefined) {
  if (!sample?.value) {
    return 0;
  }
  const value = Number(sample.value[1]);
  return Number.isFinite(value) ? value : 0;
}

function requiredValue(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function valueAfter(flag: string) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function numberAfter(flag: string) {
  const value = valueAfter(flag);
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive number`);
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function printHelp() {
  console.log(`Collect production monitoring evidence from Prometheus-compatible APIs.

Usage:
  PROMETHEUS_BASE_URL=https://prometheus.example.com DEPLOY_BASE_URL=https://app.example.com MONITORING_ALERTS_JSON='[...]' npm run monitoring:evidence:collect
  npm run monitoring:evidence:collect -- --prometheus-url https://prometheus.example.com --deploy-base-url https://app.example.com --alert-evidence artifacts/alert-evidence.json

Inputs:
  PROMETHEUS_BASE_URL / --prometheus-url       Prometheus-compatible base URL.
  PROMETHEUS_BEARER_TOKEN                      Optional bearer token for Prometheus.
  DEPLOY_BASE_URL / --deploy-base-url          Production app URL.
  MONITORING_ALERTS_JSON / --alert-evidence    Alert evidence array, or object with alerts[].
  ALERTMANAGER_BASE_URL / --alertmanager-url   Optional Alertmanager API used when alert JSON is not provided.
  ALERTMANAGER_BEARER_TOKEN                    Optional bearer token for Alertmanager.

Options:
  --output <path>                              Defaults to artifacts/monitoring-production.json.
  --max-age-hours <hours>                      Defaults to 24 for verification.
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
