import { requiredProductionMonitoringAlerts } from "./monitoring-evidence";

export type ProductionMonitoringAlertEvidence = {
  name: string;
  status: "fired_and_resolved";
  firedAt: string;
  resolvedAt: string;
};

export type ProductionMonitoringEvidenceInput = {
  checkedAt: string;
  deployBaseUrl: string;
  metricsJobUp: boolean;
  metricsSampleCount: number;
  fullReadinessProbeSuccess: boolean;
  fullReadinessProbeTarget: string;
  alerts: ProductionMonitoringAlertEvidence[];
};

type AlertmanagerAlert = {
  labels?: Record<string, unknown>;
  status?: {
    state?: unknown;
  };
  startsAt?: unknown;
  endsAt?: unknown;
};

export function buildProductionMonitoringEvidence(input: ProductionMonitoringEvidenceInput) {
  return {
    ok: hasCompleteMonitoringEvidence(input),
    checkedAt: input.checkedAt,
    deployBaseUrl: input.deployBaseUrl,
    scrape: {
      metricsJob: {
        job: "live2d-web",
        up: input.metricsJobUp,
        sampleCount: input.metricsSampleCount,
      },
      fullReadinessProbe: {
        job: "live2d-health-full",
        success: input.fullReadinessProbeSuccess,
        target: input.fullReadinessProbeTarget,
      },
    },
    alerts: input.alerts,
  };
}

export function parseProductionMonitoringAlertEvidence(value: unknown): ProductionMonitoringAlertEvidence[] {
  const alerts = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.alerts) ? value.alerts : undefined;
  if (!alerts) {
    throw new Error("Alert evidence must be an array or an object with alerts[]");
  }

  return alerts.map((alert, index) => {
    if (!isRecord(alert)) {
      throw new Error(`Alert evidence at index ${index} must be an object`);
    }

    const name = alert.name;
    const status = alert.status;
    const firedAt = alert.firedAt;
    const resolvedAt = alert.resolvedAt;
    if (typeof name !== "string" || typeof firedAt !== "string" || typeof resolvedAt !== "string") {
      throw new Error(`Alert evidence at index ${index} must include string name, firedAt, and resolvedAt`);
    }
    if (status !== "fired_and_resolved") {
      throw new Error(`Alert evidence for ${name} must use status fired_and_resolved`);
    }

    return { name, status, firedAt, resolvedAt };
  });
}

export function collectAlertmanagerResolvedAlertEvidence(value: unknown, now = new Date()): ProductionMonitoringAlertEvidence[] {
  const alerts = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.alerts) ? value.alerts : undefined;
  if (!alerts) {
    throw new Error("Alertmanager evidence must be an array or an object with alerts[]");
  }

  return requiredProductionMonitoringAlerts.flatMap((name) => {
    const matching = alerts
      .filter(isAlertmanagerAlert)
      .filter((alert) => alert.labels?.alertname === name)
      .map(toResolvedAlertEvidence(now))
      .filter((alert): alert is ProductionMonitoringAlertEvidence => alert !== undefined)
      .sort((left, right) => Date.parse(right.resolvedAt) - Date.parse(left.resolvedAt));

    return matching.slice(0, 1);
  });
}

function hasCompleteMonitoringEvidence(input: ProductionMonitoringEvidenceInput) {
  if (!input.metricsJobUp || input.metricsSampleCount <= 0 || !input.fullReadinessProbeSuccess) {
    return false;
  }

  return requiredProductionMonitoringAlerts.every((name) =>
    input.alerts.some((alert) => alert.name === name && alert.status === "fired_and_resolved" && isTimestamp(alert.firedAt) && isTimestamp(alert.resolvedAt)),
  );
}

function isTimestamp(value: string) {
  return !Number.isNaN(Date.parse(value));
}

function isAlertmanagerAlert(value: unknown): value is AlertmanagerAlert {
  return isRecord(value) && isRecord(value.labels);
}

function toResolvedAlertEvidence(now: Date) {
  return (alert: AlertmanagerAlert): ProductionMonitoringAlertEvidence | undefined => {
    const name = alert.labels?.alertname;
    const firedAt = typeof alert.startsAt === "string" ? alert.startsAt : undefined;
    const resolvedAt = typeof alert.endsAt === "string" ? alert.endsAt : undefined;
    if (typeof name !== "string" || !firedAt || !resolvedAt) {
      return undefined;
    }

    const firedTime = Date.parse(firedAt);
    const resolvedTime = Date.parse(resolvedAt);
    if (Number.isNaN(firedTime) || Number.isNaN(resolvedTime) || resolvedTime <= firedTime || resolvedTime > now.getTime() + 5 * 60 * 1000) {
      return undefined;
    }

    if (alert.status?.state === "active") {
      return undefined;
    }

    return {
      name,
      status: "fired_and_resolved",
      firedAt,
      resolvedAt,
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
