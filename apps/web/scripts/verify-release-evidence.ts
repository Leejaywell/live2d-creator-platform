import { verifyReleaseEvidence } from "../src/lib/release-evidence";

const args = process.argv.slice(2);

async function main() {
  if (args.includes("--help")) {
    printHelp();
    return;
  }

  const artifactsDir = valueAfter("--artifacts-dir") ?? "artifacts";
  const report = verifyReleaseEvidence({
    productionAuditPath: valueAfter("--production-audit") ?? `${artifactsDir}/release-audit-production.json`,
    releaseManifestPath: valueAfter("--release-manifest") ?? `${artifactsDir}/release-manifest.json`,
    dockerImagePath: valueAfter("--docker-image") ?? `${artifactsDir}/docker-image-ci.json`,
    dbBackupDir: valueAfter("--db-backup-dir") ?? `${artifactsDir}/db-backups`,
    dbBackupManifestPath: valueAfter("--db-backup-manifest") ?? `${artifactsDir}/db-backups/latest.json`,
    dbMigrationManifestPath: valueAfter("--db-migration-manifest") ?? `${artifactsDir}/db-migrations/latest.json`,
    monitoringEvidencePath: valueAfter("--monitoring-evidence") ?? `${artifactsDir}/monitoring-production.json`,
    expectedDockerTag: valueAfter("--docker-image-tag") ?? process.env.DOCKER_EVIDENCE_TAG,
    expectedDockerRevision: valueAfter("--docker-revision") ?? process.env.DOCKER_EVIDENCE_REVISION ?? process.env.GITHUB_SHA ?? process.env.GIT_COMMIT_SHA,
    maxEvidenceAgeHours: numberAfter("--max-age-hours") ?? numberFromEnv("RELEASE_EVIDENCE_MAX_AGE_HOURS") ?? 24,
  });

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

function valueAfter(flag: string) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function numberAfter(flag: string) {
  const value = valueAfter(flag);
  return value === undefined ? undefined : parsePositiveNumber(value, flag);
}

function numberFromEnv(name: string) {
  const value = process.env[name];
  return value === undefined ? undefined : parsePositiveNumber(value, name);
}

function parsePositiveNumber(value: string, source: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${source} must be a positive number`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Verify production release evidence artifacts.

Usage:
  npm run release:evidence:verify
  npm run release:evidence:verify -- --artifacts-dir artifacts

Options:
  --artifacts-dir <path>       Directory containing release artifacts. Defaults to artifacts.
  --production-audit <path>    Production audit JSON path.
  --release-manifest <path>    Release manifest JSON path.
  --docker-image <path>        Docker image inspect JSON path.
  --docker-image-tag <tag>     Expected Docker tag. Defaults to live2d-creator-platform-web:ci.
  --docker-revision <sha>      Expected OCI revision label. Defaults to CI commit env when present.
  --db-backup-dir <path>       Directory used to derive the default backup manifest path.
  --db-backup-manifest <path>  Backup manifest JSON path. Defaults to artifacts/db-backups/latest.json.
  --db-migration-manifest <path> Migration manifest JSON path. Defaults to artifacts/db-migrations/latest.json.
  --monitoring-evidence <path> Production monitoring evidence JSON path.
  --max-age-hours <hours>      Maximum evidence age. Defaults to 24.
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
