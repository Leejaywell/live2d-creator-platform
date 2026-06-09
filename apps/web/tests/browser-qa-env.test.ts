import assert from "node:assert/strict";
import test from "node:test";

import { validateBrowserQaEnv } from "../src/lib/browser-qa-env";

test("validateBrowserQaEnv accepts complete QA input", () => {
  const report = validateBrowserQaEnv({
    QA_BASE_URL: "https://app.example.com",
    QA_PROJECT_SLUG: "qa-live2d",
    QA_FAN_CODE: "L2D-AAAA-BBBB-CC",
    QA_EXPECT_LIVE2D: "false",
  });

  assert.equal(report.ok, true);
});

test("validateBrowserQaEnv requires core browser QA inputs", () => {
  const report = validateBrowserQaEnv({});

  assert.equal(report.ok, false);
  assert.deepEqual(
    report.checks.filter((check) => !check.ok).map((check) => check.name),
    ["qa_base_url", "qa_project_slug", "qa_fan_code"],
  );
});

test("validateBrowserQaEnv requires Live2D rendering evidence for production release audit", () => {
  const report = validateBrowserQaEnv(
    {
      QA_BASE_URL: "https://app.example.com",
      QA_PROJECT_SLUG: "qa-live2d",
      QA_FAN_CODE: "L2D-AAAA-BBBB-CC",
      QA_EXPECT_LIVE2D: "false",
    },
    { requireLive2D: true },
  );

  assert.equal(report.ok, false);
  assert.equal(report.checks.some((check) => check.name === "qa_expect_live2d" && !check.ok), true);
});
