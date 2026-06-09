import { securityHeaderReadiness } from "./security-headers";

export type ProductionEnvCheck = {
  name: string;
  ok: boolean;
  detail?: string;
};

export type ProductionEnv = Record<string, string | undefined>;

export type ProductionEnvReport = {
  ok: boolean;
  checkedAt: string;
  envFile?: string;
  checks: ProductionEnvCheck[];
};

const requiredProductionEnv = [
  "DATABASE_URL",
  "DEPLOY_BASE_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "EMAIL_SERVER_HOST",
  "EMAIL_SERVER_PORT",
  "EMAIL_SERVER_SECURE",
  "EMAIL_SERVER_STARTTLS",
  "EMAIL_SERVER_USER",
  "EMAIL_SERVER_PASSWORD",
  "EMAIL_FROM",
  "FAN_CODE_HASH_SECRET",
  "OPENAI_COMPATIBLE_BASE_URL",
  "OPENAI_COMPATIBLE_API_KEY",
  "OPENAI_COMPATIBLE_MODEL",
  "MAX_LIVE2D_ZIP_BYTES",
  "OBJECT_STORAGE_ENDPOINT",
  "OBJECT_STORAGE_REGION",
  "OBJECT_STORAGE_ACCESS_KEY_ID",
  "OBJECT_STORAGE_SECRET_ACCESS_KEY",
  "OBJECT_STORAGE_BUCKET",
  "OBJECT_STORAGE_FORCE_PATH_STYLE",
  "ASSET_SIGNED_URL_TTL_SECONDS",
  "ASSET_PROXY_MODE",
  "RATE_LIMIT_BACKEND",
  "REDIS_REST_URL",
  "REDIS_REST_TOKEN",
  "METRICS_BEARER_TOKEN",
  "CSP_REPORT_ONLY",
  "CSP_REPORT_URI",
  "ENABLE_HSTS",
];

const strongSecretEnv = [
  { name: "AUTH_SECRET", minLength: 32 },
  { name: "FAN_CODE_HASH_SECRET", minLength: 32 },
  { name: "METRICS_BEARER_TOKEN", minLength: 32 },
];

const credentialEnv = [
  { name: "EMAIL_SERVER_PASSWORD", minLength: 8 },
  { name: "OPENAI_COMPATIBLE_API_KEY", minLength: 8 },
  { name: "OBJECT_STORAGE_ACCESS_KEY_ID", minLength: 16 },
  { name: "OBJECT_STORAGE_SECRET_ACCESS_KEY", minLength: 16 },
  { name: "REDIS_REST_TOKEN", minLength: 8 },
];

export function validateProductionEnv(env: ProductionEnv, envFile?: string): ProductionEnvReport {
  const checks: ProductionEnvCheck[] = [];

  checks.push(checkMissing(env));
  checks.push(checkPlaceholders(env));
  checks.push(checkStrongSecrets(env));
  checks.push(checkUrls(env));
  checks.push(checkNumericEnv(env, "EMAIL_SERVER_PORT", 1, 65535));
  checks.push(checkNumericEnv(env, "MAX_LIVE2D_ZIP_BYTES", 1024 * 1024, 1024 * 1024 * 500));
  checks.push(checkNumericEnv(env, "ASSET_SIGNED_URL_TTL_SECONDS", 60, 3600));
  checks.push(checkEnum(env, "ASSET_PROXY_MODE", ["redirect", "stream"]));
  checks.push(checkEnum(env, "RATE_LIMIT_BACKEND", ["redis"]));
  checks.push(checkEnum(env, "CSP_REPORT_ONLY", ["false", ""]));
  checks.push(checkEnum(env, "ENABLE_HSTS", ["true", ""]));
  checks.push(checkEnum(env, "EMAIL_SERVER_SECURE", ["true", "false"]));
  checks.push(checkSmtpTransportSecurity(env));
  checks.push(checkSecurityHeaders(env));

  return {
    ok: checks.every((check) => check.ok),
    checkedAt: new Date().toISOString(),
    envFile,
    checks,
  };
}

function checkMissing(env: ProductionEnv): ProductionEnvCheck {
  const missing = requiredProductionEnv.filter((name) => !env[name]);
  return missing.length
    ? { name: "required_env", ok: false, detail: `Missing: ${missing.join(", ")}` }
    : { name: "required_env", ok: true };
}

function checkPlaceholders(env: ProductionEnv): ProductionEnvCheck {
  const placeholders = requiredProductionEnv.filter((name) => isPlaceholder(env[name] ?? ""));
  return placeholders.length
    ? { name: "placeholder_values", ok: false, detail: `Replace placeholder values: ${placeholders.join(", ")}` }
    : { name: "placeholder_values", ok: true };
}

function checkStrongSecrets(env: ProductionEnv): ProductionEnvCheck {
  const weak = [...strongSecretEnv, ...credentialEnv].filter(({ name, minLength }) => {
    const value = env[name] ?? "";
    return value.length < minLength || isPlaceholder(value);
  });
  return weak.length
    ? { name: "secret_strength", ok: false, detail: `Weak or placeholder secrets: ${weak.map((item) => item.name).join(", ")}` }
    : { name: "secret_strength", ok: true };
}

function checkUrls(env: ProductionEnv): ProductionEnvCheck {
  const failures: string[] = [];

  requireUrl(env.DATABASE_URL, "DATABASE_URL", ["postgresql:", "postgres:"], failures);
  requireHttps(env.DEPLOY_BASE_URL, "DEPLOY_BASE_URL", failures);
  requireHttps(env.AUTH_URL, "AUTH_URL", failures);
  requireHttps(env.OPENAI_COMPATIBLE_BASE_URL, "OPENAI_COMPATIBLE_BASE_URL", failures);
  requireHttps(env.OBJECT_STORAGE_ENDPOINT, "OBJECT_STORAGE_ENDPOINT", failures);
  requireHttps(env.REDIS_REST_URL, "REDIS_REST_URL", failures);

  const reportUri = env.CSP_REPORT_URI;
  if (reportUri && !reportUri.startsWith("/") && !isUrlWithProtocol(reportUri, ["https:"])) {
    failures.push("CSP_REPORT_URI must be a same-origin path or HTTPS URL");
  }

  return failures.length ? { name: "url_safety", ok: false, detail: failures.join("; ") } : { name: "url_safety", ok: true };
}

function checkNumericEnv(env: ProductionEnv, name: string, min: number, max: number): ProductionEnvCheck {
  const value = Number(env[name]);
  return Number.isInteger(value) && value >= min && value <= max
    ? { name: `${name.toLowerCase()}_range`, ok: true }
    : { name: `${name.toLowerCase()}_range`, ok: false, detail: `${name} must be an integer from ${min} to ${max}` };
}

function checkEnum(env: ProductionEnv, name: string, allowed: string[]): ProductionEnvCheck {
  const value = env[name] ?? "";
  return allowed.includes(value)
    ? { name: `${name.toLowerCase()}_value`, ok: true }
    : { name: `${name.toLowerCase()}_value`, ok: false, detail: `${name} must be one of: ${allowed.map((item) => item || "(empty)").join(", ")}` };
}

function checkSmtpTransportSecurity(env: ProductionEnv): ProductionEnvCheck {
  if (env.EMAIL_SERVER_SECURE === "true" || env.EMAIL_SERVER_STARTTLS === "true") {
    return { name: "email_transport_security", ok: true };
  }

  return {
    name: "email_transport_security",
    ok: false,
    detail: "EMAIL_SERVER_STARTTLS must be true unless EMAIL_SERVER_SECURE is true for implicit TLS",
  };
}

function checkSecurityHeaders(env: ProductionEnv): ProductionEnvCheck {
  try {
    securityHeaderReadiness({ ...env, NODE_ENV: "production" });
    return { name: "security_headers", ok: true };
  } catch (error) {
    return { name: "security_headers", ok: false, detail: error instanceof Error ? error.message : "Invalid production security header configuration" };
  }
}

function requireHttps(value: string | undefined, name: string, failures: string[]) {
  if (!isUrlWithProtocol(value, ["https:"])) {
    failures.push(`${name} must be HTTPS`);
  }
}

function requireUrl(value: string | undefined, name: string, protocols: string[], failures: string[]) {
  if (!isUrlWithProtocol(value, protocols)) {
    failures.push(`${name} must use ${protocols.join(" or ")}`);
  }
}

function isUrlWithProtocol(value: string | undefined, protocols: string[]) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol);
  } catch {
    return false;
  }
}

function isPlaceholder(value: string) {
  return /replace|example|your-|changeme|localhost/i.test(value);
}
