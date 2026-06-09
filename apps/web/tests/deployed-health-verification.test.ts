import assert from "node:assert/strict";
import test from "node:test";

import { verifyDeployedHealthReport } from "../src/lib/deployed-health-verification";

test("verifyDeployedHealthReport accepts production health metadata", () => {
  const report = verifyDeployedHealthReport({
    ok: true,
    service: {
      name: "live2d-creator-platform-web",
      nodeEnv: "production",
      uptimeSeconds: 42,
    },
  });

  assert.equal(report.ok, true);
});

test("verifyDeployedHealthReport rejects non-production runtime mode", () => {
  const report = verifyDeployedHealthReport({
    ok: true,
    service: {
      name: "live2d-creator-platform-web",
      nodeEnv: "development",
      uptimeSeconds: 42,
    },
  });

  assert.equal(report.ok, false);
  assert.equal(report.checks.some((check) => check.name === "runtime_node_env" && !check.ok), true);
});

test("verifyDeployedHealthReport rejects missing service metadata", () => {
  const report = verifyDeployedHealthReport({ ok: true });

  assert.equal(report.ok, false);
  assert.equal(report.checks.some((check) => check.name === "service_name" && !check.ok), true);
  assert.equal(report.checks.some((check) => check.name === "runtime_uptime" && !check.ok), true);
});
