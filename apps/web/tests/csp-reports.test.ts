import assert from "node:assert/strict";
import test from "node:test";

import { extractCspReports, recordCspReports } from "../src/lib/csp-reports";
import { renderPrometheusMetrics } from "../src/lib/metrics";

test("extractCspReports supports legacy CSP report payloads", () => {
  const reports = extractCspReports({
    "csp-report": {
      "document-uri": "https://app.example/c/urzis",
      "effective-directive": "script-src",
      "blocked-uri": "https://unexpected.example/script.js",
      disposition: "enforce",
    },
  });

  assert.deepEqual(reports, [
    {
      documentUri: "https://app.example/c/urzis",
      effectiveDirective: "script-src",
      blockedUri: "https://unexpected.example/script.js",
      sourceFile: undefined,
      lineNumber: undefined,
      disposition: "enforce",
    },
  ]);
});

test("recordCspReports increments CSP violation metrics", () => {
  withMutedWarn(() => {
    recordCspReports({
      type: "csp-violation",
      body: {
        documentURL: "https://app.example/c/urzis",
        effectiveDirective: "connect-src",
        blockedURL: "https://unexpected.example/api",
        disposition: "report",
      },
    });
  });

  const metrics = renderPrometheusMetrics();
  assert.match(metrics, /live2d_csp_violations_total\{directive="connect-src",disposition="report"\} 1/);
});

function withMutedWarn(run: () => void) {
  const original = console.warn;
  console.warn = () => {};
  try {
    run();
  } finally {
    console.warn = original;
  }
}
