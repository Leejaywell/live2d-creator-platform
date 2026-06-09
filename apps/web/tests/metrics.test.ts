import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { incrementCounter, observeHistogram, renderPrometheusMetrics } from "../src/lib/metrics";
import { runReadinessChecks } from "../src/lib/readiness";

test("renderPrometheusMetrics exposes counters and histograms", () => {
  const suffix = crypto.randomUUID().replaceAll("-", "_");
  incrementCounter(`test_counter_${suffix}_total`, "Test counter.", { route: "/test", status: 200 });
  observeHistogram(`test_duration_${suffix}_seconds`, "Test duration.", 0.2, { route: "/test" }, [0.1, 0.5]);

  const metrics = renderPrometheusMetrics();

  assert.match(metrics, new RegExp(`test_counter_${suffix}_total\\{route="/test",status="200"\\} 1`));
  assert.match(metrics, new RegExp(`test_duration_${suffix}_seconds_bucket\\{route="/test",le="0.5"\\} 1`));
  assert.match(metrics, /live2d_process_uptime_seconds/);
});

test("production readiness requires metrics bearer token", async () => {
  await withEnv({ NODE_ENV: "production", METRICS_BEARER_TOKEN: "" }, async () => {
    const report = await runReadinessChecks({
      mode: "basic",
      databaseCheck: async () => {},
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "metrics_auth" && !check.ok), true);
  });
});

async function withEnv(env: Record<string, string>, run: () => Promise<void>) {
  const previous = new Map(Object.keys(env).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }

  try {
    await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
