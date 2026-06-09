import { loadProductionEnvForValidation } from "../src/lib/production-env-file";
import type { ProductionEnv } from "../src/lib/production-env";
import { verifyDeployedHealthReport } from "../src/lib/deployed-health-verification";
import { verifySecurityHeaders } from "../src/lib/security-header-verification";

type Check = {
  name: string;
  ok: boolean;
  detail?: string;
};

type Report = {
  ok: boolean;
  checkedAt: string;
  baseUrl: string;
  checks: Check[];
};

async function main() {
  if (process.argv.includes("--help")) {
    printHelp();
    return;
  }

  const loadedEnv = loadProductionEnvForValidation(valueAfter("--app-env-file") ?? ".env.production");

  const baseUrl = requiredEnv(loadedEnv.env, "DEPLOY_BASE_URL").replace(/\/$/, "");
  const metricsToken = requiredEnv(loadedEnv.env, "METRICS_BEARER_TOKEN");
  const checks: Check[] = [];

  await check("health_basic", checks, async () => {
    const report = await fetchJson(`${baseUrl}/api/health`);
    const verification = verifyDeployedHealthReport(report);
    if (!verification.ok) {
      const failed = verification.checks
        .filter((item) => !item.ok)
        .map((item) => `${item.name}${item.detail ? `: ${item.detail}` : ""}`)
        .join(", ");
      throw new Error(`basic health verification failed: ${failed}`);
    }
  });

  await check("health_full", checks, async () => {
    const report = await fetchJson(`${baseUrl}/api/health?mode=full`);
    if (report.ok !== true) {
      const failed = Array.isArray(report.checks)
        ? report.checks.filter((item) => item && typeof item === "object" && "ok" in item && !item.ok).map((item) => item.name).join(", ")
        : "unknown";
      throw new Error(`full health failed checks: ${failed}`);
    }
  });

  await check("homepage_security_headers", checks, async () => {
    const response = await fetch(`${baseUrl}/`, {
      headers: { Accept: "text/html" },
      redirect: "manual",
    });
    if (response.status < 200 || response.status >= 400) {
      throw new Error(`homepage returned ${response.status}`);
    }
    const report = verifySecurityHeaders(response.headers, { requireHsts: baseUrl.startsWith("https://") });
    if (!report.ok) {
      const failed = report.checks
        .filter((item) => !item.ok)
        .map((item) => `${item.name}${item.detail ? `: ${item.detail}` : ""}`)
        .join(", ");
      throw new Error(`security header checks failed: ${failed}`);
    }
  });

  await check("metrics_requires_auth", checks, async () => {
    const response = await fetch(`${baseUrl}/api/metrics`);
    if (response.status !== 401) {
      throw new Error(`expected 401 without metrics token, got ${response.status}`);
    }
  });

  await check("metrics_scrape", checks, async () => {
    const response = await fetch(`${baseUrl}/api/metrics`, {
      headers: { Authorization: `Bearer ${metricsToken}` },
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`metrics returned ${response.status}: ${body.slice(0, 200)}`);
    }
    if (!body.includes("live2d_process_uptime_seconds")) {
      throw new Error("metrics body missing live2d_process_uptime_seconds");
    }
  });

  await check("csp_report_sink", checks, async () => {
    const response = await fetch(`${baseUrl}/api/csp-report`, {
      method: "POST",
      headers: { "Content-Type": "application/csp-report" },
      body: JSON.stringify({
        "csp-report": {
          "document-uri": `${baseUrl}/`,
          "effective-directive": "script-src",
          "blocked-uri": "https://post-deploy-verify.invalid/script.js",
          disposition: "report",
        },
      }),
    });
    if (response.status !== 204 && response.status !== 429) {
      throw new Error(`expected 204 or 429 from CSP report sink, got ${response.status}`);
    }
  });

  const report: Report = {
    ok: checks.every((item) => item.ok),
    checkedAt: new Date().toISOString(),
    baseUrl,
    checks,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

async function check(name: string, checks: Check[], run: () => Promise<void>) {
  try {
    await run();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, detail: error instanceof Error ? error.message : "Unknown failure" });
  }
}

async function fetchJson(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${body.slice(0, 200)}`);
  }
  return JSON.parse(body) as Record<string, unknown>;
}

function requiredEnv(env: ProductionEnv, name: string) {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function valueAfter(flag: string) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function printHelp() {
  console.log(`Verify a deployed Live2D Creator Platform app.

Usage:
  DEPLOY_BASE_URL=https://your-domain.example METRICS_BEARER_TOKEN=... npm run post-deploy:verify
  npm run post-deploy:verify -- --app-env-file .env.production
  npm run post-deploy:verify -- --app-env-file /dev/null

Checks:
  - /api/health basic readiness
  - /api/health reports NODE_ENV=production and service metadata
  - /api/health?mode=full provider readiness
  - homepage response has enforced CSP and production security headers
  - /api/metrics rejects unauthenticated requests
  - /api/metrics can be scraped with METRICS_BEARER_TOKEN
  - /api/csp-report accepts CSP reports
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
