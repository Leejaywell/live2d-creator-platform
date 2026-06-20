import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { verifyProductionMonitoringEvidence } from "./monitoring-evidence";

const defaultMaxEvidenceAgeHours = 24;

export type ReleaseEvidenceOptions = {
  productionAuditPath?: string;
  releaseManifestPath?: string;
  dockerImagePath?: string;
  dbBackupDir?: string;
  dbBackupManifestPath?: string;
  dbMigrationManifestPath?: string;
  monitoringEvidencePath?: string;
  expectedDockerTag?: string;
  expectedDockerRevision?: string;
  maxEvidenceAgeHours?: number;
  now?: Date;
};

export type ReleaseEvidenceCheck = {
  name: string;
  ok: boolean;
  detail?: string;
};

export type ReleaseEvidenceReport = {
  ok: boolean;
  checkedAt: string;
  checks: ReleaseEvidenceCheck[];
};

const requiredProductionAuditChecks = [
  "production_env_validate",
  "production_post_deploy_verify",
  "production_browser_qa_env",
  "production_browser_qa",
];

type ReleaseManifestExpectations = {
  productionAuditPath: string;
  dockerImagePath: string;
  dbBackupManifestPath: string;
  dbMigrationManifestPath: string;
  monitoringEvidencePath: string;
  expectedDockerRevision?: string;
};

export function verifyReleaseEvidence(options: ReleaseEvidenceOptions = {}): ReleaseEvidenceReport {
  const productionAuditPath = options.productionAuditPath ?? "artifacts/release-audit-production.json";
  const releaseManifestPath = options.releaseManifestPath ?? join(dirname(productionAuditPath), "release-manifest.json");
  const dockerImagePath = options.dockerImagePath ?? "artifacts/docker-image-ci.json";
  const dbBackupDir = options.dbBackupDir ?? "artifacts/db-backups";
  const dbBackupManifestPath = options.dbBackupManifestPath ?? join(dbBackupDir, "latest.json");
  const dbMigrationManifestPath = options.dbMigrationManifestPath ?? "artifacts/db-migrations/latest.json";
  const monitoringEvidencePath = options.monitoringEvidencePath ?? "artifacts/monitoring-production.json";
  const expectedDockerTag = options.expectedDockerTag ?? "live2d-creator-platform-web:ci";
  const expectedDockerRevision = options.expectedDockerRevision;
  const maxEvidenceAgeHours = options.maxEvidenceAgeHours ?? defaultMaxEvidenceAgeHours;
  const now = options.now ?? new Date();
  const dockerRevision = expectedDockerRevision ?? readReleaseManifestCommit(releaseManifestPath);

  const checks = [
    verifyReleaseManifest(
      releaseManifestPath,
      {
        productionAuditPath,
        dockerImagePath,
        dbBackupManifestPath,
        dbMigrationManifestPath,
        monitoringEvidencePath,
        expectedDockerRevision,
      },
      maxEvidenceAgeHours,
      now,
    ),
    verifyProductionAudit(productionAuditPath, maxEvidenceAgeHours, now),
    verifyDockerImageEvidence(dockerImagePath, expectedDockerTag, dockerRevision, maxEvidenceAgeHours, now),
    verifyDatabaseBackupEvidence(dbBackupDir, dbBackupManifestPath, maxEvidenceAgeHours, now),
    verifyDatabaseMigrationEvidence(dbMigrationManifestPath, dbBackupManifestPath, maxEvidenceAgeHours, now),
    ...verifyProductionMonitoringEvidence(monitoringEvidencePath, { maxEvidenceAgeHours, now }).checks,
  ];

  return {
    ok: checks.every((check) => check.ok),
    checkedAt: now.toISOString(),
    checks,
  };
}

function readReleaseManifestCommit(path: string) {
  const parsed = readJson(path);
  if (!parsed.ok || !isRecord(parsed.value) || typeof parsed.value.commitSha !== "string") {
    return undefined;
  }
  return parsed.value.commitSha;
}

function verifyReleaseManifest(
  path: string,
  expected: ReleaseManifestExpectations,
  maxEvidenceAgeHours: number,
  now: Date,
): ReleaseEvidenceCheck {
  const parsed = readJson(path);
  if (!parsed.ok) {
    return { name: "release_manifest", ok: false, detail: parsed.detail };
  }

  const manifest = parsed.value;
  if (!isRecord(manifest)) {
    return { name: "release_manifest", ok: false, detail: `${path} must contain a JSON object` };
  }

  if (typeof manifest.releaseId !== "string" || manifest.releaseId.length === 0) {
    return { name: "release_manifest", ok: false, detail: `${path} must include releaseId` };
  }

  const commitSha = manifest.commitSha;
  if (typeof commitSha !== "string" || !/^[a-f0-9]{40}$/i.test(commitSha)) {
    return { name: "release_manifest", ok: false, detail: `${path} must include a 40-character commitSha` };
  }

  if (expected.expectedDockerRevision && commitSha !== expected.expectedDockerRevision) {
    return { name: "release_manifest", ok: false, detail: `${path} commitSha ${commitSha} does not match expected ${expected.expectedDockerRevision}` };
  }

  if (!isProductionUrl(manifest.deployBaseUrl)) {
    return { name: "release_manifest", ok: false, detail: `${path} must include a production HTTPS deployBaseUrl` };
  }

  const createdAt = parseTimestamp(manifest.createdAt);
  if (!createdAt) {
    return { name: "release_manifest", ok: false, detail: `${path} must include a valid createdAt timestamp` };
  }

  const freshnessFailure = verifyFreshness("release_manifest", path, "createdAt", createdAt, maxEvidenceAgeHours, now);
  if (freshnessFailure) {
    return freshnessFailure;
  }

  const workflow = manifest.workflow;
  if (!isRecord(workflow) || workflow.provider !== "github_actions" || typeof workflow.runId !== "string" || workflow.runId.length === 0) {
    return { name: "release_manifest", ok: false, detail: `${path} must include GitHub Actions workflow run metadata` };
  }

  const artifactPaths = manifest.artifactPaths;
  if (!isRecord(artifactPaths)) {
    return { name: "release_manifest", ok: false, detail: `${path} must include artifactPaths` };
  }

  const expectedPaths: Record<string, string> = {
    productionAudit: expected.productionAuditPath,
    dockerImage: expected.dockerImagePath,
    databaseBackupManifest: expected.dbBackupManifestPath,
    databaseMigrationManifest: expected.dbMigrationManifestPath,
    monitoringEvidence: expected.monitoringEvidencePath,
  };
  const mismatched = Object.entries(expectedPaths).filter(([name, expectedPath]) => artifactPaths[name] !== expectedPath);
  if (mismatched.length > 0) {
    return {
      name: "release_manifest",
      ok: false,
      detail: `${path} artifactPaths mismatch: ${mismatched.map(([name]) => name).join(", ")}`,
    };
  }

  return { name: "release_manifest", ok: true, detail: path };
}

function verifyProductionAudit(path: string, maxEvidenceAgeHours: number, now: Date): ReleaseEvidenceCheck {
  const parsed = readJson(path);
  if (!parsed.ok) {
    return { name: "production_release_audit", ok: false, detail: parsed.detail };
  }

  const audit = parsed.value;
  if (!isRecord(audit)) {
    return { name: "production_release_audit", ok: false, detail: `${path} must contain a JSON object` };
  }

  if (audit.ok !== true) {
    return { name: "production_release_audit", ok: false, detail: `${path} does not report ok=true` };
  }

  if (audit.requireProduction !== true) {
    return { name: "production_release_audit", ok: false, detail: `${path} was not run with requireProduction=true` };
  }

  const checkedAt = parseTimestamp(audit.checkedAt);
  if (!checkedAt) {
    return { name: "production_release_audit", ok: false, detail: `${path} must include a valid checkedAt timestamp` };
  }

  const freshnessFailure = verifyFreshness("production_release_audit", path, "checkedAt", checkedAt, maxEvidenceAgeHours, now);
  if (freshnessFailure) {
    return freshnessFailure;
  }

  const auditChecks = audit.checks;
  if (!Array.isArray(auditChecks)) {
    return { name: "production_release_audit", ok: false, detail: `${path} is missing checks[]` };
  }

  const missingOrFailed = requiredProductionAuditChecks.filter((name) => {
    const check = auditChecks.find((candidate) => isRecord(candidate) && candidate.name === name);
    return !isRecord(check) || check.required !== true || check.ok !== true;
  });

  if (missingOrFailed.length > 0) {
    return {
      name: "production_release_audit",
      ok: false,
      detail: `Missing or failed required production checks: ${missingOrFailed.join(", ")}`,
    };
  }

  return { name: "production_release_audit", ok: true, detail: path };
}

function verifyDockerImageEvidence(
  path: string,
  expectedTag: string,
  expectedRevision: string | undefined,
  maxEvidenceAgeHours: number,
  now: Date,
): ReleaseEvidenceCheck {
  const parsed = readJson(path);
  if (!parsed.ok) {
    return { name: "docker_image_evidence", ok: false, detail: parsed.detail };
  }

  if (!Array.isArray(parsed.value) || parsed.value.length === 0) {
    return { name: "docker_image_evidence", ok: false, detail: `${path} must contain a non-empty docker image inspect array` };
  }

  const matchingImage = parsed.value.find((image) => {
    if (!isRecord(image) || typeof image.Id !== "string" || image.Id.length === 0) {
      return false;
    }
    return Array.isArray(image.RepoTags) && image.RepoTags.includes(expectedTag);
  });

  if (!matchingImage) {
    return {
      name: "docker_image_evidence",
      ok: false,
      detail: `${path} must include an image id tagged ${expectedTag}`,
    };
  }

  const created = isRecord(matchingImage) ? parseTimestamp(matchingImage.Created) : undefined;
  if (!created) {
    return { name: "docker_image_evidence", ok: false, detail: `${path} must include image Created timestamp for ${expectedTag}` };
  }

  const freshnessFailure = verifyFreshness("docker_image_evidence", path, "Created", created, maxEvidenceAgeHours, now);
  if (freshnessFailure) {
    return freshnessFailure;
  }

  const labels = isRecord(matchingImage) && isRecord(matchingImage.Config) && isRecord(matchingImage.Config.Labels) ? matchingImage.Config.Labels : undefined;
  if (!labels) {
    return { name: "docker_image_evidence", ok: false, detail: `${path} must include OCI image labels` };
  }

  const revision = labels["org.opencontainers.image.revision"];
  if (typeof revision !== "string" || !/^[a-f0-9]{40}$/i.test(revision)) {
    return { name: "docker_image_evidence", ok: false, detail: `${path} must include a 40-character OCI revision label` };
  }

  if (expectedRevision && revision !== expectedRevision) {
    return { name: "docker_image_evidence", ok: false, detail: `${path} revision ${revision} does not match expected ${expectedRevision}` };
  }

  const source = labels["org.opencontainers.image.source"];
  if (typeof source !== "string" || source.length === 0 || source === "unknown") {
    return { name: "docker_image_evidence", ok: false, detail: `${path} must include an OCI source label` };
  }

  return { name: "docker_image_evidence", ok: true, detail: `${path} contains ${expectedTag}` };
}

function verifyDatabaseBackupEvidence(path: string, manifestPath: string, maxEvidenceAgeHours: number, now: Date): ReleaseEvidenceCheck {
  const manifest = verifyDatabaseBackupManifest(manifestPath, maxEvidenceAgeHours, now);
  if (manifest.ok) {
    return manifest;
  }

  return {
    name: "database_backup_evidence",
    ok: false,
    detail: `${manifest.detail}; final release evidence requires ${manifestPath}, not raw dump fallback from ${path}`,
  };
}

function verifyDatabaseBackupManifest(path: string, maxEvidenceAgeHours: number, now: Date): ReleaseEvidenceCheck {
  const parsed = readJson(path);
  if (!parsed.ok) {
    return { name: "database_backup_evidence", ok: false, detail: parsed.detail };
  }

  const manifest = parsed.value;
  if (!isRecord(manifest)) {
    return { name: "database_backup_evidence", ok: false, detail: `${path} must contain a JSON object` };
  }

  if (manifest.format !== "pg_dump_custom") {
    return { name: "database_backup_evidence", ok: false, detail: `${path} must report format=pg_dump_custom` };
  }

  if (typeof manifest.backupPath !== "string" || !manifest.backupPath.endsWith(".dump")) {
    return { name: "database_backup_evidence", ok: false, detail: `${path} must include a .dump backupPath` };
  }

  if (typeof manifest.sizeBytes !== "number" || !Number.isFinite(manifest.sizeBytes) || manifest.sizeBytes <= 0) {
    return { name: "database_backup_evidence", ok: false, detail: `${path} must include a positive sizeBytes` };
  }

  if (typeof manifest.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(manifest.sha256)) {
    return { name: "database_backup_evidence", ok: false, detail: `${path} must include a sha256 digest` };
  }

  const createdAt = parseTimestamp(manifest.createdAt);
  if (!createdAt) {
    return { name: "database_backup_evidence", ok: false, detail: `${path} must include a valid createdAt timestamp` };
  }

  const freshnessFailure = verifyFreshness("database_backup_evidence", path, "createdAt", createdAt, maxEvidenceAgeHours, now);
  if (freshnessFailure) {
    return freshnessFailure;
  }

  return { name: "database_backup_evidence", ok: true, detail: `${path} records ${manifest.sizeBytes} backup bytes` };
}

function verifyDatabaseMigrationEvidence(
  path: string,
  expectedBackupManifestPath: string,
  maxEvidenceAgeHours: number,
  now: Date,
): ReleaseEvidenceCheck {
  const parsed = readJson(path);
  if (!parsed.ok) {
    return { name: "database_migration_evidence", ok: false, detail: parsed.detail };
  }

  const manifest = parsed.value;
  if (!isRecord(manifest)) {
    return { name: "database_migration_evidence", ok: false, detail: `${path} must contain a JSON object` };
  }

  if (manifest.status !== "applied") {
    return { name: "database_migration_evidence", ok: false, detail: `${path} must report status=applied` };
  }

  if (manifest.command !== "prisma db push") {
    return { name: "database_migration_evidence", ok: false, detail: `${path} must report prisma db push` };
  }

  if (manifest.schema !== "prisma/schema.prisma") {
    return { name: "database_migration_evidence", ok: false, detail: `${path} must report prisma/schema.prisma` };
  }

  if (manifest.backupManifestPath !== expectedBackupManifestPath) {
    return {
      name: "database_migration_evidence",
      ok: false,
      detail: `${path} must reference backup manifest ${expectedBackupManifestPath}`,
    };
  }

  const startedAt = parseTimestamp(manifest.startedAt);
  const finishedAt = parseTimestamp(manifest.finishedAt);
  const createdAt = parseTimestamp(manifest.createdAt);
  if (!startedAt || !finishedAt || !createdAt) {
    return { name: "database_migration_evidence", ok: false, detail: `${path} must include valid startedAt, finishedAt, and createdAt timestamps` };
  }

  if (finishedAt.getTime() < startedAt.getTime()) {
    return { name: "database_migration_evidence", ok: false, detail: `${path} finishedAt must be after startedAt` };
  }

  const freshnessFailure = verifyFreshness("database_migration_evidence", path, "createdAt", createdAt, maxEvidenceAgeHours, now);
  if (freshnessFailure) {
    return freshnessFailure;
  }

  return { name: "database_migration_evidence", ok: true, detail: `${path} proves prisma db push succeeded` };
}

function readJson(path: string): { ok: true; value: unknown } | { ok: false; detail: string } {
  if (!existsSync(path)) {
    return { ok: false, detail: `${path} does not exist` };
  }

  try {
    return { ok: true, value: JSON.parse(readFileSync(path, "utf8")) };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseTimestamp(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time);
}

function isProductionUrl(value: unknown) {
  if (typeof value !== "string" || value.includes("your-domain.example") || value.includes("localhost")) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function verifyFreshness(
  name: string,
  path: string,
  field: string,
  timestamp: Date,
  maxEvidenceAgeHours: number,
  now: Date,
): ReleaseEvidenceCheck | undefined {
  const ageMs = now.getTime() - timestamp.getTime();

  if (ageMs < -5 * 60 * 1000) {
    return { name, ok: false, detail: `${path} ${field} is in the future` };
  }

  if (ageMs > maxEvidenceAgeHours * 60 * 60 * 1000) {
    return { name, ok: false, detail: `${path} ${field} is older than ${maxEvidenceAgeHours} hour(s)` };
  }

  return undefined;
}
