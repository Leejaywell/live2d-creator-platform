import { spawn } from "node:child_process";

type CheckDefinition = {
  name: string;
  command: string[];
  required: boolean;
};

type CheckResult = CheckDefinition & {
  ok: boolean;
  exitCode: number | null;
  durationMs: number;
  stdoutTail?: string;
  stderrTail?: string;
};

const args = process.argv.slice(2);
const full = args.includes("--full");
const browser = args.includes("--browser");
const explicitAppEnvFile = valueAfter("--app-env-file");
const appEnvFile = explicitAppEnvFile ?? (browser && !full ? ".env.qa" : full ? ".env.integration" : ".env");

const checks: CheckDefinition[] = [
  { name: "prisma_validate", command: ["npx", "prisma", "validate"], required: true },
  { name: "unit_tests", command: ["npm", "test"], required: true },
  { name: "lint", command: ["npm", "run", "lint"], required: true },
  { name: "build", command: ["npm", "run", "build"], required: true },
  {
    name: "standalone_output",
    command: ["sh", "-c", "test -f .next/standalone/server.js && test -d .next/static && ! find .next/standalone -maxdepth 1 \\( -name '.env' -o -name '.env.*' \\) | grep -q ."],
    required: true,
  },
  { name: "docker_deploy_files", command: ["sh", "-c", "test -f Dockerfile && test -f .dockerignore"], required: true },
  { name: "docker_node_image_arg", command: ["sh", "-c", "grep -q '^ARG NODE_IMAGE=node:22-alpine' Dockerfile && grep -q '^FROM \\${NODE_IMAGE} AS deps' Dockerfile"], required: true },
  { name: "docker_build_env_placeholder", command: ["sh", "-c", "grep -q '^ARG DATABASE_URL=' Dockerfile && grep -q '^ENV DATABASE_URL=\\$DATABASE_URL' Dockerfile"], required: true },
  { name: "docker_provenance_labels", command: ["sh", "-c", "grep -q 'org.opencontainers.image.revision=\\$VCS_REF' Dockerfile && grep -q 'org.opencontainers.image.source=\\$SOURCE_URL' Dockerfile"], required: true },
  { name: "docker_build_script_syntax", command: ["node", "--check", "scripts/docker-build.mjs"], required: true },
  { name: "audit_high", command: ["npm", "audit", "--omit=dev", "--audit-level=high"], required: true },
  { name: "ci_workflow", command: ["npm", "run", "ci:verify"], required: true },
  { name: "monitoring_rules", command: ["npm", "run", "monitoring:verify"], required: true },
  { name: "monitoring_evidence_collect_entrypoint", command: ["tsx", "scripts/collect-monitoring-evidence.ts", "--help"], required: true },
  { name: "monitoring_evidence_entrypoint", command: ["tsx", "scripts/verify-monitoring-evidence.ts", "--help"], required: true },
  {
    name: "integration_compose_config",
    command: ["docker", "compose", "-f", "docker-compose.integration.yml", "config"],
    required: true,
  },
  { name: "integration_script_syntax", command: ["sh", "-n", "scripts/integration-readiness.sh"], required: true },
  { name: "integration_host_script_syntax", command: ["sh", "-n", "scripts/integration-host.sh"], required: true },
  { name: "browser_qa_host_script_syntax", command: ["sh", "-n", "scripts/browser-qa-host.sh"], required: true },
  { name: "db_backup_script_syntax", command: ["sh", "-n", "scripts/db-backup.sh"], required: true },
  { name: "production_migrate_script_syntax", command: ["sh", "-n", "scripts/production-migrate.sh"], required: true },
  { name: "integration_e2e_entrypoint", command: ["tsx", "scripts/integration-e2e.ts", "--help"], required: true },
  { name: "browser_qa_env_entrypoint", command: ["tsx", "scripts/validate-browser-qa-env.ts", "--help"], required: true },
  { name: "browser_qa_env_writer_entrypoint", command: ["tsx", "scripts/write-browser-qa-env.ts", "--help"], required: true },
  { name: "post_deploy_verify_entrypoint", command: ["tsx", "scripts/post-deploy-verify.ts", "--help"], required: true },
  { name: "production_env_validate_entrypoint", command: ["tsx", "scripts/validate-production-env.ts", "--help"], required: true },
  { name: "release_manifest_entrypoint", command: ["tsx", "scripts/write-release-manifest.ts", "--help"], required: true },
  { name: "release_evidence_entrypoint", command: ["tsx", "scripts/verify-release-evidence.ts", "--help"], required: true },
  {
    name: "seed_production_guard",
    command: [
      "sh",
      "-c",
      "NODE_ENV=production DATABASE_URL=postgresql://unused:unused@localhost:5432/unused tsx prisma/seed.ts >/tmp/live2d-seed-prod.out 2>/tmp/live2d-seed-prod.err; status=$?; test \"$status\" -ne 0 && grep -q 'SEED_SUPER_ADMIN_EMAIL and SEED_CREATOR_EMAIL are required' /tmp/live2d-seed-prod.err",
    ],
    required: true,
  },
  { name: "final_release_audit_entrypoint", command: ["tsx", "scripts/final-release-audit.ts", "--help"], required: true },
  { name: "fake_s3_syntax", command: ["node", "--check", "scripts/fake-s3-server.mjs"], required: true },
  { name: "fake_smtp_syntax", command: ["node", "--check", "scripts/fake-smtp-mailpit-server.mjs"], required: true },
  { name: "standalone_start_syntax", command: ["node", "--check", "scripts/start-standalone.mjs"], required: true },
  { name: "standalone_sanitize_syntax", command: ["node", "--check", "scripts/sanitize-standalone-output.mjs"], required: true },
];

if (full && shouldRunProviderReadiness()) {
  checks.push({
    name: "full_provider_readiness",
    command: ["tsx", "scripts/readiness.ts", "--app-env-file", appEnvFile, "--full"],
    required: true,
  });
}

if (full) {
  checks.push({ name: "integration_ci", command: ["npm", "run", "integration:ci"], required: true });
}

if (browser) {
  checks.push({
    name: "post_deploy_browser_qa",
    command: ["tsx", "scripts/browser-qa.ts", "--app-env-file", appEnvFile],
    required: true,
  });
}

async function main() {
  const results: CheckResult[] = [];
  for (const check of checks) {
    results.push(await runCheck(check));
  }

  const report = {
    ok: results.every((result) => result.ok || !result.required),
    checkedAt: new Date().toISOString(),
    mode: full ? "full" : "local",
    appEnvFile,
    providerReadinessIncluded: checks.some((check) => check.name === "full_provider_readiness"),
    browserQaIncluded: browser,
    checks: results,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

function runCheck(check: CheckDefinition): Promise<CheckResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(check.command[0], check.command.slice(1), {
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
  if (!trimmed) {
    return undefined;
  }
  const lines = trimmed.split(/\r?\n/);
  return lines.slice(-40).join("\n");
}

function valueAfter(flag: string) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function shouldRunProviderReadiness() {
  if (args.includes("--providers")) {
    return true;
  }
  return Boolean(explicitAppEnvFile && appEnvFile !== ".env.integration");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
