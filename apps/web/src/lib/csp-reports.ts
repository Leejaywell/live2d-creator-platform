import { incrementCounter, logEvent } from "@/lib/metrics";

export type CspViolationReport = {
  documentUri?: string;
  effectiveDirective: string;
  blockedUri?: string;
  sourceFile?: string;
  lineNumber?: number;
  disposition?: string;
};

export function recordCspReports(payload: unknown) {
  const reports = extractCspReports(payload);
  for (const report of reports) {
    incrementCounter(
      "live2d_csp_violations_total",
      "Total CSP violation reports received.",
      {
        directive: report.effectiveDirective,
        disposition: report.disposition || "unknown",
      },
    );
    logEvent("warn", "csp_violation", {
      documentUri: report.documentUri,
      effectiveDirective: report.effectiveDirective,
      blockedUri: report.blockedUri,
      sourceFile: report.sourceFile,
      lineNumber: report.lineNumber,
      disposition: report.disposition,
    });
  }
  return reports;
}

export function extractCspReports(payload: unknown): CspViolationReport[] {
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => extractCspReports(item));
  }

  if (!isRecord(payload)) {
    return [];
  }

  const cspReport = payload["csp-report"];
  if (isRecord(cspReport)) {
    return [normalizeLegacyReport(cspReport)];
  }

  if (payload.type === "csp-violation" && isRecord(payload.body)) {
    return [normalizeReportToBody(payload.body)];
  }

  return [];
}

function normalizeLegacyReport(report: Record<string, unknown>): CspViolationReport {
  return {
    documentUri: stringValue(report["document-uri"]),
    effectiveDirective: normalizeDirective(stringValue(report["effective-directive"]) || stringValue(report["violated-directive"])),
    blockedUri: stringValue(report["blocked-uri"]),
    sourceFile: stringValue(report["source-file"]),
    lineNumber: numberValue(report["line-number"]),
    disposition: stringValue(report.disposition),
  };
}

function normalizeReportToBody(body: Record<string, unknown>): CspViolationReport {
  return {
    documentUri: stringValue(body.documentURL),
    effectiveDirective: normalizeDirective(stringValue(body.effectiveDirective)),
    blockedUri: stringValue(body.blockedURL),
    sourceFile: stringValue(body.sourceFile),
    lineNumber: numberValue(body.lineNumber),
    disposition: stringValue(body.disposition),
  };
}

function normalizeDirective(value?: string) {
  const directive = (value || "unknown").split(/\s+/)[0].toLowerCase();
  return /^[a-z0-9-]+$/.test(directive) ? directive : "unknown";
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length <= 2048 ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
