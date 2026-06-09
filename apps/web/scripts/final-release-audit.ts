import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type AuditCheck = {
  name: string;
  command?: string[];
  required: boolean;
  skipped?: boolean;
  reason?: string;
};

type AuditResult = AuditCheck & {
  ok: boolean;
  exitCode?: number | null;
  durationMs?: number;
  stdoutTail?: string;
  stderrTail?: string;
};

const args = process.argv.slice(2);
const includeHost = args.includes("--host");
const includeBrowserHost = args.includes("--browser-host");
const includeProduction = args.includes("--production") || Boolean(process.env.DEPLOY_BASE_URL);
const includeProductionBrowser = args.includes("--browser") || Boolean(process.env.QA_BASE_URL);
const requireProduction = args.includes("--require-production");
const outputPath = valueAfter("--output");
const productionEnvFile = valueAfter("--production-env-file") ?? ".env.production";
const browserEnvFile = valueAfter("--browser-env-file") ?? ".env.qa";

async function main() {
  if (args.includes("--help")) {
    printHelp();
    return;
  }

  const checks: AuditCheck[] = [
    { name: "local_release_verify", command: ["npm", "run", "release:verify"], required: true },
  ];

  if (includeHost) {
    checks.push({ name: "host_integration", command: ["npm", "run", "integration:host"], required: true });
  }

  if (includeBrowserHost) {
    checks.push({ name: "host_browser_qa", command: ["npm", "run", "browser:qa:host"], required: true });
  }

  if (includeProduction) {
    checks.push({
      name: "production_env_validate",
      command: ["npm", "run", "env:validate:production", "--", "--app-env-file", productionEnvFile],
      required: true,
    });
    checks.push({
      name: "production_post_deploy_verify",
      command: ["npm", "run", "post-deploy:verify", "--", "--app-env-file", productionEnvFile],
      required: true,
    });
  } else {
    checks.push({
      name: "production_env_validate",
      required: requireProduction,
      skipped: true,
      reason: "DEPLOY_BASE_URL is not configured and --production was not passed",
    });
    checks.push({
      name: "production_post_deploy_verify",
      required: requireProduction,
      skipped: true,
      reason: "DEPLOY_BASE_URL is not configured and --production was not passed",
    });
  }

  if (includeProductionBrowser) {
    if (requireProduction) {
      checks.push({
        name: "production_browser_qa_env",
        command: ["tsx", "scripts/validate-browser-qa-env.ts", "--app-env-file", browserEnvFile, "--require-live2d"],
        required: true,
      });
    }
    checks.push({ name: "production_browser_qa", command: ["tsx", "scripts/browser-qa.ts", "--app-env-file", browserEnvFile], required: true });
  } else {
    checks.push({
      name: "production_browser_qa",
      required: requireProduction,
      skipped: true,
      reason: "QA_BASE_URL is not configured and --browser was not passed",
    });
  }

  const results: AuditResult[] = [];
  for (const check of checks) {
    results.push(await runAuditCheck(check));
  }

  const report = {
    ok: results.every((result) => result.ok || !result.required),
    checkedAt: new Date().toISOString(),
    requireProduction,
    checks: results,
  };

  const json = JSON.stringify(report, null, 2);
  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${json}\n`);
  }

  console.log(json);
  if (!report.ok) {
    process.exitCode = 1;
  }
}

async function runAuditCheck(check: AuditCheck): Promise<AuditResult> {
  if (check.skipped || !check.command) {
    return { ...check, ok: false };
  }

  const [command, ...commandArgs] = check.command;
  if (!command) {
    return { ...check, ok: false, stderrTail: "Missing command" };
  }

  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      resolve({
        ...check,
        ok: false,
        exitCode: null,
        durationMs: Date.now() - started,
        stderrTail: error.message,
      });
    });
    child.on("close", (exitCode) => {
      resolve({
        ...check,
        ok: exitCode === 0,
        exitCode,
        durationMs: Date.now() - started,
        stdoutTail: tail(Buffer.concat(stdout).toString("utf8")),
        stderrTail: tail(Buffer.concat(stderr).toString("utf8")),
      });
    });
  });
}

function tail(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.split(/\r?\n/).slice(-60).join("\n");
}

function valueAfter(flag: string) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function printHelp() {
  console.log(`Run final release evidence audit.

Usage:
  npm run release:audit
  npm run release:audit:host
  DEPLOY_BASE_URL=https://your-domain.example METRICS_BEARER_TOKEN=... npm run release:audit:production
  npm run release:audit -- --output artifacts/release-audit-local.json

Modes:
  --host                 Run host integration after local release verification.
  --browser-host         Run local host browser QA.
  --production           Validate .env.production and run post-deploy verification.
  --browser              Run production browser QA using .env.qa.
  --require-production   Fail when production post-deploy/browser evidence is missing.
                         Also requires QA_EXPECT_LIVE2D=true before production browser QA.
  --production-env-file  Env file for production env and post-deploy checks; use /dev/null for CI-injected env.
  --browser-env-file     Env file for production browser QA; use /dev/null for CI-injected env.
  --output <path>        Write the audit report JSON to a file.
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
