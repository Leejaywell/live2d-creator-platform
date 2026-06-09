import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);

async function main() {
  if (args.includes("--help")) {
    printHelp();
    return;
  }

  const artifactsDir = valueAfter("--artifacts-dir") ?? "artifacts";
  const outputPath = valueAfter("--output") ?? `${artifactsDir}/release-manifest.json`;
  const commitSha = requiredEnv("GITHUB_SHA");
  const deployBaseUrl = requiredEnv("DEPLOY_BASE_URL").replace(/\/$/, "");
  const runId = requiredEnv("GITHUB_RUN_ID");
  const repository = requiredEnv("GITHUB_REPOSITORY");
  const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  const runAttempt = process.env.GITHUB_RUN_ATTEMPT;

  const manifest = {
    releaseId: process.env.RELEASE_ID ?? `github-${runId}-${commitSha.slice(0, 12)}`,
    commitSha,
    deployBaseUrl,
    createdAt: new Date().toISOString(),
    workflow: {
      provider: "github_actions",
      repository,
      runId,
      runAttempt,
      runUrl: `${serverUrl}/${repository}/actions/runs/${runId}`,
    },
    artifactPaths: {
      productionAudit: `${artifactsDir}/release-audit-production.json`,
      dockerImage: `${artifactsDir}/docker-image-ci.json`,
      databaseBackupManifest: `${artifactsDir}/db-backups/latest.json`,
      databaseMigrationManifest: `${artifactsDir}/db-migrations/latest.json`,
      monitoringEvidence: `${artifactsDir}/monitoring-production.json`,
    },
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, outputPath, releaseId: manifest.releaseId }, null, 2));
}

function valueAfter(flag: string) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function printHelp() {
  console.log(`Write the production release manifest.

Usage:
  npm run release:manifest:write
  npm run release:manifest:write -- --artifacts-dir artifacts

Options:
  --artifacts-dir <path>  Directory containing release artifacts. Defaults to artifacts.
  --output <path>        Manifest output path. Defaults to artifacts/release-manifest.json.

Required environment:
  GITHUB_SHA, GITHUB_RUN_ID, GITHUB_REPOSITORY, DEPLOY_BASE_URL
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
