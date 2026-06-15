import assert from "node:assert/strict";
import test from "node:test";

import { runReadinessChecks } from "../src/lib/readiness";

const requiredEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
  AUTH_SECRET: "a".repeat(40),
  AUTH_URL: "https://example.com",
  FAN_CODE_HASH_SECRET: "b".repeat(40),
  PAYMENT_WEBHOOK_SECRET: "p".repeat(40),
  PAYMENT_CHECKOUT_URL_TEMPLATE: "https://pay.example.com/checkout?order={orderId}",
  OPENAI_COMPATIBLE_BASE_URL: "https://api.example.com/v1",
  OPENAI_COMPATIBLE_API_KEY: "ai-key",
  OPENAI_COMPATIBLE_MODEL: "model",
  OBJECT_STORAGE_ENDPOINT: "https://storage.example.com",
  OBJECT_STORAGE_ACCESS_KEY_ID: "storage-key",
  OBJECT_STORAGE_SECRET_ACCESS_KEY: "storage-secret",
  OBJECT_STORAGE_BUCKET: "bucket",
  ASSET_PROXY_MODE: "stream",
};

test("basic readiness passes with required environment and database check", async () => {
  await withEnv(requiredEnv, async () => {
    const report = await runReadinessChecks({
      mode: "basic",
      databaseCheck: async () => {},
    });

    assert.equal(report.ok, true);
    assert.equal(report.mode, "basic");
    assert.equal(report.checks.some((check) => check.name === "database" && check.ok), true);
  });
});

test("basic readiness fails weak placeholder secrets", async () => {
  await withEnv({ ...requiredEnv, AUTH_SECRET: "replace-with-secret" }, async () => {
    const report = await runReadinessChecks({
      mode: "basic",
      databaseCheck: async () => {},
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "auth_secret_strength" && !check.ok), true);
  });
});

test("basic readiness reports database check failure", async () => {
  await withEnv(requiredEnv, async () => {
    const report = await runReadinessChecks({
      mode: "basic",
      databaseCheck: async () => {
        throw new Error("database unavailable");
      },
    });

    assert.equal(report.ok, false);
    assert.match(report.checks.find((check) => check.name === "database")?.detail ?? "", /database unavailable/);
  });
});

test("basic readiness rejects unsafe checkout URL template", async () => {
  await withEnv({ ...requiredEnv, PAYMENT_CHECKOUT_URL_TEMPLATE: "https://pay.example.com/checkout" }, async () => {
    const report = await runReadinessChecks({
      mode: "basic",
      databaseCheck: async () => {},
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "checkout_url_template" && !check.ok), true);
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
