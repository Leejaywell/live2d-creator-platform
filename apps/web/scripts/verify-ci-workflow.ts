import { readFileSync } from "node:fs";

const workflowPath = ".github/workflows/ci.yml";
const workflow = readFileSync(workflowPath, "utf8");
const productionReleaseAuditJob = jobSection("production-release-audit");
const browserQaJob = jobSection("browser-qa");

const requiredProductionAuditEnv = [
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
  "MONITORING_EVIDENCE_JSON",
  "PROMETHEUS_BASE_URL",
  "PROMETHEUS_BEARER_TOKEN",
  "ALERTMANAGER_BASE_URL",
  "ALERTMANAGER_BEARER_TOKEN",
  "MONITORING_ALERTS_JSON",
  "CSP_REPORT_ONLY",
  "CSP_REPORT_URI",
  "CSP_CONNECT_SRC",
  "CSP_SCRIPT_SRC",
  "ENABLE_HSTS",
  "QA_BASE_URL",
  "QA_PROJECT_SLUG",
  "QA_FAN_CODE",
  "QA_CHAT_MESSAGE",
  "QA_CREATOR_EMAIL",
  "QA_PROJECT_NAME",
  "QA_MODEL_ZIP_PATH",
  "QA_MODEL_ZIP_URL",
  "QA_MODEL_ZIP_SHA256",
  "QA_EXPECT_LIVE2D",
];

const failures: string[] = [];

if (!workflow.includes("production-release-audit:")) {
  failures.push("Missing production-release-audit job");
}

if (!workflow.includes("browser-qa:")) {
  failures.push("Missing browser-qa job");
}

for (const name of requiredProductionAuditEnv) {
  if (!new RegExp(`^\\s+${name}:`, "m").test(productionReleaseAuditJob)) {
    failures.push(`production-release-audit env is missing ${name}`);
  }
}

const requiredWorkflowSnippets = [
  "npm run docker:build",
  "DOCKER_IMAGE_TAG: live2d-creator-platform-web:ci",
  "DOCKER_IMAGE_REVISION: ${{ github.sha }}",
  "DOCKER_IMAGE_SOURCE_URL: ${{ github.server_url }}/${{ github.repository }}",
  "docker image inspect live2d-creator-platform-web:ci > artifacts/docker-image-ci.json",
  "name: live2d-docker-image-ci",
  "artifacts/docker-image-ci.json",
];

const requiredProductionAuditSnippets = [
  "needs: [quality, integration, docker-build]",
  "actions/download-artifact@v4",
  "name: live2d-docker-image-ci",
  "sudo apt-get install -y postgresql-client",
  "if [ -z \"$MONITORING_EVIDENCE_JSON\" ]; then",
  "test -n \"$PROMETHEUS_BASE_URL\"",
  "if [ -z \"$MONITORING_ALERTS_JSON\" ]; then",
  "test -n \"$ALERTMANAGER_BASE_URL\"",
  "npm run env:validate:production -- --app-env-file /dev/null",
  "npm run db:migrate:production",
  "Prepare production browser QA env",
  "npm run qa:env:write -- --output .env.qa.release",
  "npm run qa:provision -- --app-env-file /dev/null --write-env .env.qa.release",
  "npx tsx scripts/validate-browser-qa-env.ts --app-env-file .env.qa.release --require-live2d",
  "printf '%s\\n' \"$MONITORING_EVIDENCE_JSON\" > artifacts/monitoring-production.json",
  "npm run monitoring:evidence:collect -- --prometheus-url \"$PROMETHEUS_BASE_URL\" --deploy-base-url \"$DEPLOY_BASE_URL\"",
  "npm run monitoring:evidence:verify",
  "npm run release:audit:production -- --production-env-file /dev/null --browser-env-file .env.qa.release",
  "npm run release:manifest:write",
  "npm run release:evidence:verify",
  "test \"$QA_EXPECT_LIVE2D\" = \"true\"",
  "actions/upload-artifact@v4",
  "name: live2d-production-release-evidence",
  "artifacts/release-manifest.json",
  "artifacts/release-audit-production.json",
  "artifacts/docker-image-ci.json",
  "artifacts/db-backups/latest.json",
  "artifacts/db-migrations/latest.json",
  "artifacts/monitoring-production.json",
];

for (const snippet of requiredWorkflowSnippets) {
  if (!workflow.includes(snippet)) {
    failures.push(`Workflow is missing ${snippet}`);
  }
}

for (const snippet of requiredProductionAuditSnippets) {
  if (!productionReleaseAuditJob.includes(snippet)) {
    failures.push(`Workflow is missing ${snippet}`);
  }
}

for (const snippet of [
  "DATABASE_URL: ${{ secrets.DATABASE_URL }}",
  "FAN_CODE_HASH_SECRET: ${{ secrets.FAN_CODE_HASH_SECRET }}",
  "OBJECT_STORAGE_ENDPOINT: ${{ vars.OBJECT_STORAGE_ENDPOINT }}",
  "QA_MODEL_ZIP_URL: ${{ secrets.QA_MODEL_ZIP_URL }}",
  "if [ -z \"$QA_FAN_CODE\" ]; then",
  "npm run qa:env:write -- --output .env.qa.workflow",
  "npm run qa:provision -- --app-env-file /dev/null --write-env .env.qa.workflow",
  "npx tsx scripts/validate-browser-qa-env.ts --app-env-file .env.qa.workflow",
  "npx tsx scripts/browser-qa.ts --app-env-file .env.qa.workflow",
]) {
  if (!browserQaJob.includes(snippet)) {
    failures.push(`browser-qa job is missing ${snippet}`);
  }
}

const report = {
  ok: failures.length === 0,
  file: workflowPath,
  checked: {
    productionAuditEnv: requiredProductionAuditEnv.length,
  },
  failures,
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) {
  process.exitCode = 1;
}

function jobSection(jobName: string) {
  const start = workflow.search(new RegExp(`^  ${jobName}:`, "m"));
  if (start === -1) return "";

  const rest = workflow.slice(start + 1);
  const nextJob = rest.search(/^  [a-zA-Z0-9_-]+:/m);
  return nextJob === -1 ? workflow.slice(start) : workflow.slice(start, start + 1 + nextJob);
}
