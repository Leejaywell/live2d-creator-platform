import crypto from "node:crypto";
import { inspect } from "node:util";

import { Client } from "pg";

import { checkRedisRateLimitConnection, rateLimitReadiness } from "@/lib/rate-limit";
import { securityHeaderReadiness } from "@/lib/security-headers";
import { verifySmtpConnection } from "@/lib/smtp";
import { deleteObject, getObjectBytes, putObject, signedGetUrl } from "@/lib/storage";

export type ReadinessMode = "basic" | "full";

export type ReadinessCheck = {
  name: string;
  ok: boolean;
  detail?: string;
};

export type ReadinessReport = {
  ok: boolean;
  mode: ReadinessMode;
  checkedAt: string;
  service: {
    name: string;
    version?: string;
    commitSha?: string;
    nodeEnv?: string;
    uptimeSeconds: number;
  };
  checks: ReadinessCheck[];
};

const requiredEnv = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "EMAIL_SERVER_HOST",
  "EMAIL_SERVER_PORT",
  "EMAIL_SERVER_USER",
  "EMAIL_SERVER_PASSWORD",
  "EMAIL_FROM",
  "FAN_CODE_HASH_SECRET",
  "OPENAI_COMPATIBLE_BASE_URL",
  "OPENAI_COMPATIBLE_API_KEY",
  "OPENAI_COMPATIBLE_MODEL",
  "OBJECT_STORAGE_ENDPOINT",
  "OBJECT_STORAGE_ACCESS_KEY_ID",
  "OBJECT_STORAGE_SECRET_ACCESS_KEY",
  "OBJECT_STORAGE_BUCKET",
];

export async function runReadinessChecks(input: {
  mode?: ReadinessMode;
  databaseCheck?: () => Promise<void>;
} = {}): Promise<ReadinessReport> {
  const mode = input.mode ?? "basic";
  const checks: ReadinessCheck[] = [];

  checks.push(checkRequiredEnv());
  checks.push(checkSecretStrength("AUTH_SECRET"));
  checks.push(checkSecretStrength("FAN_CODE_HASH_SECRET"));
  checks.push(checkAssetProxyMode());
  checks.push(await wrapCheck("metrics_auth", async () => checkMetricsAuth()));
  checks.push(await wrapCheck("security_headers", async () => securityHeaderReadiness()));
  checks.push(await wrapCheck("rate_limit_backend", async () => rateLimitReadiness()));
  checks.push(await wrapCheck("database", input.databaseCheck ?? defaultDatabaseCheck));

  if (mode === "full") {
    checks.push(await wrapCheck("rate_limit_connection", checkRedisRateLimitConnection));
    checks.push(await wrapCheck("object_storage_roundtrip", checkObjectStorageRoundTrip));
    checks.push(await wrapCheck("smtp_connection", checkSmtpConnection));
    checks.push(await wrapCheck("ai_completion", checkAiCompletion));
  }

  return {
    ok: checks.every((check) => check.ok),
    mode,
    checkedAt: new Date().toISOString(),
    service: {
      name: "live2d-creator-platform-web",
      version: process.env.npm_package_version,
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA,
      nodeEnv: process.env.NODE_ENV,
      uptimeSeconds: Math.round(process.uptime()),
    },
    checks,
  };
}

function checkRequiredEnv(): ReadinessCheck {
  const missing = requiredEnv.filter((name) => !process.env[name]);
  return missing.length
    ? { name: "required_env", ok: false, detail: `Missing: ${missing.join(", ")}` }
    : { name: "required_env", ok: true };
}

function checkSecretStrength(name: string): ReadinessCheck {
  const value = process.env[name] ?? "";
  if (value.length < 32 || /replace|example|changeme|secret/i.test(value)) {
    return { name: `${name.toLowerCase()}_strength`, ok: false, detail: `${name} must be a strong production secret` };
  }
  return { name: `${name.toLowerCase()}_strength`, ok: true };
}

function checkAssetProxyMode(): ReadinessCheck {
  const mode = process.env.ASSET_PROXY_MODE ?? "redirect";
  return mode === "redirect" || mode === "stream"
    ? { name: "asset_proxy_mode", ok: true, detail: mode }
    : { name: "asset_proxy_mode", ok: false, detail: "ASSET_PROXY_MODE must be redirect or stream" };
}

function checkMetricsAuth() {
  if (process.env.NODE_ENV === "production" && !process.env.METRICS_BEARER_TOKEN) {
    throw new Error("METRICS_BEARER_TOKEN is required in production");
  }
}

async function defaultDatabaseCheck() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    await client.end();
  }
}

async function checkObjectStorageRoundTrip() {
  const key = `readiness/${crypto.randomUUID()}.txt`;
  const body = Buffer.from(`readiness:${Date.now()}`);

  await putObject({
    key,
    body,
    contentType: "text/plain; charset=utf-8",
    cacheControl: "no-store",
  });

  try {
    const object = await getObjectBytes(key);
    if (!object.body.equals(body)) {
      throw new Error("Readiness object body mismatch");
    }
    await signedGetUrl(key, 60);
  } finally {
    await deleteObject(key);
  }
}

async function checkSmtpConnection() {
  await verifySmtpConnection();
}

async function checkAiCompletion() {
  const baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL;
  const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY;
  const model = process.env.OPENAI_COMPATIBLE_MODEL;
  if (!baseUrl || !apiKey || !model) {
    throw new Error("AI environment is not configured");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 8,
      messages: [{ role: "user", content: "Reply with OK." }],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI completion failed with status ${response.status}`);
  }
}

async function wrapCheck(name: string, check: () => Promise<void>): Promise<ReadinessCheck> {
  try {
    await check();
    return { name, ok: true };
  } catch (error) {
    return { name, ok: false, detail: formatError(error) };
  }
}

function formatError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Unknown failure";
  }
  return error.message || inspect(error, { depth: 2, breakLength: 120 });
}
