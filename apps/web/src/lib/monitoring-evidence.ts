import { existsSync, readFileSync } from "node:fs";

export const requiredProductionMonitoringAlerts = [
  "Live2DWebMetricsScrapeDown",
  "Live2DFullReadinessDown",
  "Live2DHttp5xx",
  "Live2DChatHighLatency",
  "Live2DRateLimitSpike",
  "Live2DCspViolations",
];

export type MonitoringEvidenceCheck = {
  name: string;
  ok: boolean;
  detail?: string;
};

export type MonitoringEvidenceReport = {
  ok: boolean;
  checkedAt: string;
  checks: MonitoringEvidenceCheck[];
};

export type MonitoringEvidenceOptions = {
  maxEvidenceAgeHours?: number;
  now?: Date;
};

export function verifyProductionMonitoringEvidence(
  path = "artifacts/monitoring-production.json",
  options: MonitoringEvidenceOptions = {},
): MonitoringEvidenceReport {
  const checks = [verifyMonitoringEvidenceFile(path, options)];

  return {
    ok: checks.every((check) => check.ok),
    checkedAt: (options.now ?? new Date()).toISOString(),
    checks,
  };
}

function verifyMonitoringEvidenceFile(path: string, options: MonitoringEvidenceOptions): MonitoringEvidenceCheck {
  const parsed = readJson(path);
  if (!parsed.ok) {
    return { name: "production_monitoring_evidence", ok: false, detail: parsed.detail };
  }

  const evidence = parsed.value;
  if (!isRecord(evidence)) {
    return { name: "production_monitoring_evidence", ok: false, detail: `${path} must contain a JSON object` };
  }

  if (evidence.ok !== true) {
    return { name: "production_monitoring_evidence", ok: false, detail: `${path} does not report ok=true` };
  }

  const checkedAt = parseTimestamp(evidence.checkedAt);
  if (!checkedAt) {
    return { name: "production_monitoring_evidence", ok: false, detail: `${path} must include a valid checkedAt timestamp` };
  }

  const freshnessFailure = verifyFreshness(path, "checkedAt", checkedAt, options);
  if (freshnessFailure) {
    return freshnessFailure;
  }

  if (!isProductionHttpsUrl(evidence.deployBaseUrl)) {
    return { name: "production_monitoring_evidence", ok: false, detail: `${path} must include a production HTTPS deployBaseUrl` };
  }

  if (!isRecord(evidence.scrape)) {
    return { name: "production_monitoring_evidence", ok: false, detail: `${path} must include scrape evidence` };
  }

  const metricsJob = evidence.scrape.metricsJob;
  if (!isRecord(metricsJob) || metricsJob.job !== "live2d-web" || metricsJob.up !== true || !isPositiveNumber(metricsJob.sampleCount)) {
    return {
      name: "production_monitoring_evidence",
      ok: false,
      detail: `${path} must prove live2d-web metrics scrape is up with samples`,
    };
  }

  const fullReadinessProbe = evidence.scrape.fullReadinessProbe;
  if (
    !isRecord(fullReadinessProbe) ||
    fullReadinessProbe.job !== "live2d-health-full" ||
    fullReadinessProbe.success !== true ||
    !isProductionHttpsUrl(fullReadinessProbe.target) ||
    !String(fullReadinessProbe.target).includes("/api/health?mode=full")
  ) {
    return {
      name: "production_monitoring_evidence",
      ok: false,
      detail: `${path} must prove live2d-health-full blackbox probe success`,
    };
  }

  const alerts = evidence.alerts;
  if (!Array.isArray(alerts)) {
    return { name: "production_monitoring_evidence", ok: false, detail: `${path} must include alerts[] evidence` };
  }

  const missingOrUnprovedAlerts = requiredProductionMonitoringAlerts.filter((name) => {
    const alert = alerts.find((candidate) => isRecord(candidate) && candidate.name === name);
    return (
      !isRecord(alert) ||
      alert.status !== "fired_and_resolved" ||
      !parseTimestamp(alert.firedAt) ||
      !parseTimestamp(alert.resolvedAt)
    );
  });

  if (missingOrUnprovedAlerts.length > 0) {
    return {
      name: "production_monitoring_evidence",
      ok: false,
      detail: `Missing fired-and-resolved production alert evidence: ${missingOrUnprovedAlerts.join(", ")}`,
    };
  }

  return {
    name: "production_monitoring_evidence",
    ok: true,
    detail: `${path} proves scrape, full readiness probe, and ${requiredProductionMonitoringAlerts.length} alert(s)`,
  };
}

function readJson(path: string): { ok: true; value: unknown } | { ok: false; detail: string } {
  if (!existsSync(path)) {
    return { ok: false, detail: `${path} does not exist` };
  }

  try {
    return { ok: true, value: JSON.parse(readFileSync(path, "utf8")) };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function parseTimestamp(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time);
}

function isProductionHttpsUrl(value: unknown) {
  if (typeof value !== "string" || value.includes("your-domain.example") || value.includes("localhost")) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function verifyFreshness(
  path: string,
  field: string,
  timestamp: Date,
  options: MonitoringEvidenceOptions,
): MonitoringEvidenceCheck | undefined {
  if (options.maxEvidenceAgeHours === undefined) {
    return undefined;
  }

  const now = options.now ?? new Date();
  const maxAgeMs = options.maxEvidenceAgeHours * 60 * 60 * 1000;
  const ageMs = now.getTime() - timestamp.getTime();

  if (ageMs < -5 * 60 * 1000) {
    return { name: "production_monitoring_evidence", ok: false, detail: `${path} ${field} is in the future` };
  }

  if (ageMs > maxAgeMs) {
    return {
      name: "production_monitoring_evidence",
      ok: false,
      detail: `${path} ${field} is older than ${options.maxEvidenceAgeHours} hour(s)`,
    };
  }

  return undefined;
}
