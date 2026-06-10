import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { applyScriptEnvToProcess, loadEnvFileForScript } from "../src/lib/env-file";
import { loadProductionEnvForValidation } from "../src/lib/production-env-file";
import { validateProductionEnv } from "../src/lib/production-env";

const validEnv: NodeJS.ProcessEnv = {
  DATABASE_URL: "postgresql://user:pass@db.internal:5432/app",
  DEPLOY_BASE_URL: "https://app.live2d-prod.com",
  AUTH_SECRET: "a".repeat(40),
  AUTH_URL: "https://app.live2d-prod.com",
  EMAIL_SERVER_HOST: "smtp.provider.test",
  EMAIL_SERVER_PORT: "587",
  EMAIL_SERVER_SECURE: "false",
  EMAIL_SERVER_STARTTLS: "true",
  EMAIL_SERVER_USER: "apikey",
  EMAIL_SERVER_PASSWORD: "mail-password-with-enough-length",
  EMAIL_FROM: "Live2D <no-reply@live2d-prod.com>",
  FAN_CODE_HASH_SECRET: "b".repeat(40),
  PAYMENT_WEBHOOK_SECRET: "p".repeat(40),
  PAYMENT_CHECKOUT_URL_TEMPLATE: "https://pay.provider.test/checkout?order={orderId}",
  OPENAI_COMPATIBLE_BASE_URL: "https://api.provider.test/v1",
  OPENAI_COMPATIBLE_API_KEY: "ai-key-with-enough-length",
  OPENAI_COMPATIBLE_MODEL: "model",
  MAX_LIVE2D_ZIP_BYTES: "104857600",
  OBJECT_STORAGE_ENDPOINT: "https://storage.provider.test",
  OBJECT_STORAGE_REGION: "auto",
  OBJECT_STORAGE_ACCESS_KEY_ID: "storage-access-key-prod-value",
  OBJECT_STORAGE_SECRET_ACCESS_KEY: "storage-secret-key-prod-value",
  OBJECT_STORAGE_BUCKET: "live2d-prod-assets",
  OBJECT_STORAGE_FORCE_PATH_STYLE: "true",
  ASSET_SIGNED_URL_TTL_SECONDS: "900",
  ASSET_PROXY_MODE: "redirect",
  RATE_LIMIT_BACKEND: "redis",
  REDIS_REST_URL: "https://redis.provider.test",
  REDIS_REST_TOKEN: "redis-token-with-enough-length",
  METRICS_BEARER_TOKEN: "metrics-token-with-enough-length",
  CSP_REPORT_ONLY: "false",
  CSP_REPORT_URI: "/api/csp-report",
  ENABLE_HSTS: "true",
};

test("validateProductionEnv accepts production-safe values", () => {
  const report = validateProductionEnv(validEnv, ".env.production");

  assert.equal(report.ok, true);
  assert.equal(report.envFile, ".env.production");
});

test("validateProductionEnv accepts implicit TLS SMTP without STARTTLS", () => {
  const report = validateProductionEnv({
    ...validEnv,
    EMAIL_SERVER_PORT: "465",
    EMAIL_SERVER_SECURE: "true",
    EMAIL_SERVER_STARTTLS: "false",
  });

  assert.equal(report.ok, true);
  assert.equal(report.checks.some((check) => check.name === "email_transport_security" && check.ok), true);
});

test("validateProductionEnv accepts common provider credential lengths", () => {
  const report = validateProductionEnv({
    ...validEnv,
    EMAIL_SERVER_PASSWORD: "app-pass-123",
    OPENAI_COMPATIBLE_API_KEY: "sk-prod1",
    OBJECT_STORAGE_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE".replace("EXAMPLE", "PROD"),
    OBJECT_STORAGE_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYPRODKEY",
    REDIS_REST_TOKEN: "redis123",
  });

  assert.equal(report.ok, true);
});

test("validateProductionEnv rejects placeholders and unsafe production modes", () => {
  const report = validateProductionEnv({
    ...validEnv,
    DEPLOY_BASE_URL: "https://your-domain.example",
    AUTH_URL: "http://localhost:3000",
    AUTH_SECRET: "replace-with-secret",
    RATE_LIMIT_BACKEND: "memory",
    CSP_REPORT_ONLY: "true",
    ENABLE_HSTS: "false",
    EMAIL_SERVER_STARTTLS: "false",
  });

  assert.equal(report.ok, false);
  assert.equal(report.checks.some((check) => check.name === "placeholder_values" && !check.ok), true);
  assert.equal(report.checks.some((check) => check.name === "url_safety" && !check.ok), true);
  assert.equal(report.checks.some((check) => check.name === "rate_limit_backend_value" && !check.ok), true);
  assert.equal(report.checks.some((check) => check.name === "csp_report_only_value" && !check.ok), true);
  assert.equal(report.checks.some((check) => check.name === "enable_hsts_value" && !check.ok), true);
  assert.equal(report.checks.some((check) => check.name === "email_transport_security" && !check.ok), true);
});

test("validateProductionEnv rejects unsafe production CSP source overrides", () => {
  const report = validateProductionEnv({
    ...validEnv,
    CSP_SCRIPT_SRC: "'unsafe-eval'",
    CSP_CONNECT_SRC: "http://localhost:4000",
  });

  assert.equal(report.ok, false);
  assert.equal(report.checks.some((check) => check.name === "security_headers" && !check.ok), true);
});

test("validateProductionEnv rejects unsafe checkout URL templates", () => {
  const report = validateProductionEnv({
    ...validEnv,
    PAYMENT_CHECKOUT_URL_TEMPLATE: "http://pay.provider.test/checkout?order={orderId}",
  });

  assert.equal(report.ok, false);
  assert.equal(report.checks.some((check) => check.name === "url_safety" && !check.ok), true);
});

test("loadProductionEnvForValidation validates the env file without process env masking", () => {
  const dir = mkdtempSync(join(tmpdir(), "production-env-"));
  const envFile = join(dir, ".env.production");

  try {
    writeFileSync(
      envFile,
      serializeEnv({
        ...validEnv,
        DEPLOY_BASE_URL: "https://your-domain.example",
      }),
    );

    const loaded = loadProductionEnvForValidation(envFile, {
      ...validEnv,
      DEPLOY_BASE_URL: "https://real-production.example.com",
    });
    const report = validateProductionEnv(loaded.env, loaded.envFile);

    assert.equal(loaded.source, "file");
    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "placeholder_values" && !check.ok), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadProductionEnvForValidation supports CI process env injection with /dev/null", () => {
  const loaded = loadProductionEnvForValidation("/dev/null", validEnv);
  const report = validateProductionEnv(loaded.env, loaded.envFile);

  assert.equal(loaded.source, "process");
  assert.equal(report.ok, true);
});

test("loadProductionEnvForValidation does not fall back to process env when a file path is missing", () => {
  const loaded = loadProductionEnvForValidation("/tmp/live2d-missing-production-env", validEnv);
  const report = validateProductionEnv(loaded.env, loaded.envFile);

  assert.equal(loaded.source, "file");
  assert.equal(report.ok, false);
  assert.equal(report.checks.some((check) => check.name === "required_env" && !check.ok), true);
});

test("loadEnvFileForScript isolates QA env files from process env", () => {
  const dir = mkdtempSync(join(tmpdir(), "qa-env-"));
  const envFile = join(dir, ".env.qa");

  try {
    writeFileSync(
      envFile,
      serializeEnv({
        QA_BASE_URL: "https://qa-file.example.com",
        QA_PROJECT_SLUG: "file-project",
        QA_FAN_CODE: "FILE-CODE",
      }),
    );

    const loaded = loadEnvFileForScript(envFile, {
      QA_BASE_URL: "https://process.example.com",
      QA_PROJECT_SLUG: "process-project",
      QA_FAN_CODE: "PROCESS-CODE",
    });

    assert.equal(loaded.source, "file");
    assert.equal(loaded.env.QA_BASE_URL, "https://qa-file.example.com");
    assert.equal(loaded.env.QA_PROJECT_SLUG, "file-project");
    assert.equal(loaded.env.QA_FAN_CODE, "FILE-CODE");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("applyScriptEnvToProcess clears stale app env keys in file mode", () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousAuthSecret = process.env.AUTH_SECRET;

  process.env.DATABASE_URL = "postgresql://stale:stale@localhost:5432/stale";
  process.env.AUTH_SECRET = "stale-auth-secret";

  try {
    applyScriptEnvToProcess(
      {
        env: {
          AUTH_SECRET: "file-auth-secret",
        },
        envFile: ".env.test",
        source: "file",
      },
      ["DATABASE_URL", "AUTH_SECRET"],
    );

    assert.equal(process.env.DATABASE_URL, undefined);
    assert.equal(process.env.AUTH_SECRET, "file-auth-secret");
  } finally {
    restoreEnv("DATABASE_URL", previousDatabaseUrl);
    restoreEnv("AUTH_SECRET", previousAuthSecret);
  }
});

test("applyScriptEnvToProcess keeps injected process env in process mode", () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;

  process.env.DATABASE_URL = "postgresql://injected:injected@localhost:5432/injected";

  try {
    applyScriptEnvToProcess(
      {
        env: process.env,
        envFile: "/dev/null",
        source: "process",
      },
      ["DATABASE_URL"],
    );

    assert.equal(process.env.DATABASE_URL, "postgresql://injected:injected@localhost:5432/injected");
  } finally {
    restoreEnv("DATABASE_URL", previousDatabaseUrl);
  }
});

function serializeEnv(env: Record<string, string | undefined>) {
  return Object.entries(env)
    .map(([key, value]) => `${key}=${JSON.stringify(value ?? "")}`)
    .join("\n");
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
