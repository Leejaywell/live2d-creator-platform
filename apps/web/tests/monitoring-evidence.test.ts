import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildProductionMonitoringEvidence,
  collectAlertmanagerResolvedAlertEvidence,
  parseProductionMonitoringAlertEvidence,
} from "../src/lib/monitoring-evidence-collection";
import { requiredProductionMonitoringAlerts, verifyProductionMonitoringEvidence } from "../src/lib/monitoring-evidence";

const now = new Date("2026-06-06T01:00:00.000Z");
const currentEvidenceTime = "2026-06-06T00:00:00.000Z";
const staleEvidenceTime = "2026-06-04T00:00:00.000Z";

test("verifyProductionMonitoringEvidence accepts complete production monitoring evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "monitoring-evidence-"));

  try {
    const path = join(dir, "monitoring-production.json");
    writeMonitoringEvidence(path);

    const report = verifyProductionMonitoringEvidence(path, { maxEvidenceAgeHours: 24, now });

    assert.equal(report.ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("buildProductionMonitoringEvidence creates verifier-compatible evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "monitoring-evidence-"));

  try {
    const path = join(dir, "monitoring-production.json");
    const evidence = buildProductionMonitoringEvidence({
      checkedAt: currentEvidenceTime,
      deployBaseUrl: "https://app.live2d-prod.com",
      metricsJobUp: true,
      metricsSampleCount: 12,
      fullReadinessProbeSuccess: true,
      fullReadinessProbeTarget: "https://app.live2d-prod.com/api/health?mode=full",
      alerts: completeAlertEvidence(),
    });
    writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`);

    const report = verifyProductionMonitoringEvidence(path, { maxEvidenceAgeHours: 24, now });

    assert.equal(report.ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("parseProductionMonitoringAlertEvidence accepts retained alerts[] evidence", () => {
  const alerts = parseProductionMonitoringAlertEvidence({ alerts: completeAlertEvidence() });

  assert.equal(alerts.length, requiredProductionMonitoringAlerts.length);
  assert.equal(alerts[0].status, "fired_and_resolved");
});

test("collectAlertmanagerResolvedAlertEvidence converts resolved Alertmanager alerts", () => {
  const alerts = collectAlertmanagerResolvedAlertEvidence(
    completeAlertEvidence().map((alert) => ({
      labels: { alertname: alert.name },
      status: { state: "suppressed" },
      startsAt: alert.firedAt,
      endsAt: alert.resolvedAt,
    })),
    now,
  );

  assert.equal(alerts.length, requiredProductionMonitoringAlerts.length);
  assert.equal(alerts[0].status, "fired_and_resolved");
});

test("collectAlertmanagerResolvedAlertEvidence ignores active Alertmanager alerts", () => {
  const alerts = collectAlertmanagerResolvedAlertEvidence(
    completeAlertEvidence().map((alert) => ({
      labels: { alertname: alert.name },
      status: { state: "active" },
      startsAt: alert.firedAt,
      endsAt: alert.resolvedAt,
    })),
    now,
  );

  assert.equal(alerts.length, 0);
});

test("verifyProductionMonitoringEvidence rejects placeholder deploy targets", () => {
  const dir = mkdtempSync(join(tmpdir(), "monitoring-evidence-"));

  try {
    const path = join(dir, "monitoring-production.json");
    writeMonitoringEvidence(path, { deployBaseUrl: "https://your-domain.example" });

    const report = verifyProductionMonitoringEvidence(path, { maxEvidenceAgeHours: 24, now });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "production_monitoring_evidence" && !check.ok), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyProductionMonitoringEvidence rejects missing fired-and-resolved alert evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "monitoring-evidence-"));

  try {
    const path = join(dir, "monitoring-production.json");
    writeMonitoringEvidence(path, { alerts: [{ name: requiredProductionMonitoringAlerts[0], status: "firing" }] });

    const report = verifyProductionMonitoringEvidence(path, { maxEvidenceAgeHours: 24, now });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.detail?.includes("Missing fired-and-resolved")), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyProductionMonitoringEvidence rejects stale monitoring evidence when max age is set", () => {
  const dir = mkdtempSync(join(tmpdir(), "monitoring-evidence-"));

  try {
    const path = join(dir, "monitoring-production.json");
    writeMonitoringEvidence(path, { checkedAt: staleEvidenceTime });

    const report = verifyProductionMonitoringEvidence(path, { maxEvidenceAgeHours: 24, now });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.detail?.includes("older than")), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeMonitoringEvidence(path: string, override: Record<string, unknown> = {}) {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        ok: true,
        checkedAt: currentEvidenceTime,
        deployBaseUrl: "https://app.live2d-prod.com",
        scrape: {
          metricsJob: {
            job: "live2d-web",
            up: true,
            sampleCount: 32,
          },
          fullReadinessProbe: {
            job: "live2d-health-full",
            success: true,
            target: "https://app.live2d-prod.com/api/health?mode=full",
          },
        },
        alerts: completeAlertEvidence(),
        ...override,
      },
      null,
      2,
    )}\n`,
  );
}

function completeAlertEvidence() {
  return requiredProductionMonitoringAlerts.map((name, index) => ({
    name,
    status: "fired_and_resolved" as const,
    firedAt: `2026-06-06T00:0${index}:00.000Z`,
    resolvedAt: `2026-06-06T00:1${index}:00.000Z`,
  }));
}
