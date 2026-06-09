import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { requiredProductionMonitoringAlerts } from "../src/lib/monitoring-evidence";
import { verifyReleaseEvidence } from "../src/lib/release-evidence";

const now = new Date("2026-06-06T01:00:00.000Z");
const currentEvidenceTime = "2026-06-06T00:00:00.000Z";
const staleEvidenceTime = "2026-06-04T00:00:00.000Z";
const currentRevision = "a".repeat(40);
const otherRevision = "b".repeat(40);

test("verifyReleaseEvidence accepts complete production release artifacts with a backup manifest", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-evidence-"));

  try {
    writeCompleteEvidence(dir);

    const report = verifyReleaseEvidence({
      productionAuditPath: join(dir, "release-audit-production.json"),
      dockerImagePath: join(dir, "docker-image-ci.json"),
      dbBackupDir: join(dir, "db-backups"),
      dbMigrationManifestPath: join(dir, "db-migrations", "latest.json"),
      monitoringEvidencePath: join(dir, "monitoring-production.json"),
      now,
    });

    assert.equal(report.ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyReleaseEvidence rejects missing release manifest", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-evidence-"));

  try {
    writeCompleteEvidence(dir);
    rmSync(join(dir, "release-manifest.json"), { force: true });

    const report = verifyReleaseEvidence({
      productionAuditPath: join(dir, "release-audit-production.json"),
      dockerImagePath: join(dir, "docker-image-ci.json"),
      dbBackupDir: join(dir, "db-backups"),
      dbMigrationManifestPath: join(dir, "db-migrations", "latest.json"),
      monitoringEvidencePath: join(dir, "monitoring-production.json"),
      now,
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "release_manifest" && !check.ok), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyReleaseEvidence rejects release manifest for a different revision", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-evidence-"));

  try {
    writeCompleteEvidence(dir);

    const report = verifyReleaseEvidence({
      productionAuditPath: join(dir, "release-audit-production.json"),
      dockerImagePath: join(dir, "docker-image-ci.json"),
      dbBackupDir: join(dir, "db-backups"),
      dbMigrationManifestPath: join(dir, "db-migrations", "latest.json"),
      monitoringEvidencePath: join(dir, "monitoring-production.json"),
      expectedDockerRevision: otherRevision,
      now,
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "release_manifest" && check.detail?.includes("does not match")), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyReleaseEvidence rejects production audit missing required checks", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-evidence-"));

  try {
    writeCompleteEvidence(dir, {
      checks: [{ name: "production_env_validate", required: true, ok: true }],
    });

    const report = verifyReleaseEvidence({
      productionAuditPath: join(dir, "release-audit-production.json"),
      dockerImagePath: join(dir, "docker-image-ci.json"),
      dbBackupDir: join(dir, "db-backups"),
      dbMigrationManifestPath: join(dir, "db-migrations", "latest.json"),
      monitoringEvidencePath: join(dir, "monitoring-production.json"),
      now,
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "production_release_audit" && !check.ok), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyReleaseEvidence rejects Docker evidence without expected tag", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-evidence-"));

  try {
    writeCompleteEvidence(dir, undefined, [{ Id: "sha256:abc", RepoTags: ["other:tag"] }]);

    const report = verifyReleaseEvidence({
      productionAuditPath: join(dir, "release-audit-production.json"),
      dockerImagePath: join(dir, "docker-image-ci.json"),
      dbBackupDir: join(dir, "db-backups"),
      dbMigrationManifestPath: join(dir, "db-migrations", "latest.json"),
      monitoringEvidencePath: join(dir, "monitoring-production.json"),
      now,
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "docker_image_evidence" && !check.ok), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyReleaseEvidence rejects Docker evidence without OCI revision label", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-evidence-"));

  try {
    writeCompleteEvidence(dir, undefined, [{ Id: "sha256:abc", Created: currentEvidenceTime, RepoTags: ["live2d-creator-platform-web:ci"] }]);

    const report = verifyReleaseEvidence({
      productionAuditPath: join(dir, "release-audit-production.json"),
      dockerImagePath: join(dir, "docker-image-ci.json"),
      dbBackupDir: join(dir, "db-backups"),
      dbMigrationManifestPath: join(dir, "db-migrations", "latest.json"),
      monitoringEvidencePath: join(dir, "monitoring-production.json"),
      now,
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "docker_image_evidence" && check.detail?.includes("OCI image labels")), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyReleaseEvidence rejects Docker evidence for a different revision", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-evidence-"));

  try {
    writeCompleteEvidence(dir);

    const report = verifyReleaseEvidence({
      productionAuditPath: join(dir, "release-audit-production.json"),
      dockerImagePath: join(dir, "docker-image-ci.json"),
      dbBackupDir: join(dir, "db-backups"),
      dbMigrationManifestPath: join(dir, "db-migrations", "latest.json"),
      monitoringEvidencePath: join(dir, "monitoring-production.json"),
      expectedDockerRevision: otherRevision,
      now,
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "docker_image_evidence" && check.detail?.includes("does not match")), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyReleaseEvidence rejects Docker evidence that differs from the release manifest commit", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-evidence-"));

  try {
    writeCompleteEvidence(dir, undefined, [
      {
        Id: "sha256:abc",
        Created: currentEvidenceTime,
        RepoTags: ["live2d-creator-platform-web:ci"],
        Config: {
          Labels: {
            "org.opencontainers.image.revision": otherRevision,
            "org.opencontainers.image.source": "https://github.com/example/live2d-creator-platform",
          },
        },
      },
    ]);

    const report = verifyReleaseEvidence({
      productionAuditPath: join(dir, "release-audit-production.json"),
      dockerImagePath: join(dir, "docker-image-ci.json"),
      dbBackupDir: join(dir, "db-backups"),
      dbMigrationManifestPath: join(dir, "db-migrations", "latest.json"),
      monitoringEvidencePath: join(dir, "monitoring-production.json"),
      now,
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "docker_image_evidence" && check.detail?.includes("does not match")), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyReleaseEvidence rejects missing database backup evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-evidence-"));

  try {
    writeCompleteEvidence(dir);
    rmSync(join(dir, "db-backups"), { recursive: true, force: true });

    const report = verifyReleaseEvidence({
      productionAuditPath: join(dir, "release-audit-production.json"),
      dockerImagePath: join(dir, "docker-image-ci.json"),
      dbBackupDir: join(dir, "db-backups"),
      dbMigrationManifestPath: join(dir, "db-migrations", "latest.json"),
      monitoringEvidencePath: join(dir, "monitoring-production.json"),
      now,
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "database_backup_evidence" && !check.ok), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyReleaseEvidence rejects raw dump without backup manifest", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-evidence-"));

  try {
    writeCompleteEvidence(dir);
    rmSync(join(dir, "db-backups", "latest.json"), { force: true });
    writeFileSync(join(dir, "db-backups", "live2d-20260606.dump"), "backup");

    const report = verifyReleaseEvidence({
      productionAuditPath: join(dir, "release-audit-production.json"),
      dockerImagePath: join(dir, "docker-image-ci.json"),
      dbBackupDir: join(dir, "db-backups"),
      dbMigrationManifestPath: join(dir, "db-migrations", "latest.json"),
      monitoringEvidencePath: join(dir, "monitoring-production.json"),
      now,
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "database_backup_evidence" && check.detail?.includes("requires")), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyReleaseEvidence rejects invalid database backup manifest", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-evidence-"));

  try {
    writeCompleteEvidence(dir, undefined, undefined, { sizeBytes: 0 });

    const report = verifyReleaseEvidence({
      productionAuditPath: join(dir, "release-audit-production.json"),
      dockerImagePath: join(dir, "docker-image-ci.json"),
      dbBackupDir: join(dir, "db-backups"),
      dbMigrationManifestPath: join(dir, "db-migrations", "latest.json"),
      monitoringEvidencePath: join(dir, "monitoring-production.json"),
      now,
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "database_backup_evidence" && !check.ok), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyReleaseEvidence rejects missing database migration evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-evidence-"));

  try {
    writeCompleteEvidence(dir);
    rmSync(join(dir, "db-migrations"), { recursive: true, force: true });

    const report = verifyReleaseEvidence({
      productionAuditPath: join(dir, "release-audit-production.json"),
      dockerImagePath: join(dir, "docker-image-ci.json"),
      dbBackupDir: join(dir, "db-backups"),
      dbMigrationManifestPath: join(dir, "db-migrations", "latest.json"),
      monitoringEvidencePath: join(dir, "monitoring-production.json"),
      now,
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "database_migration_evidence" && !check.ok), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyReleaseEvidence rejects invalid database migration manifest", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-evidence-"));

  try {
    writeCompleteEvidence(dir, undefined, undefined, undefined, { status: "pending" });

    const report = verifyReleaseEvidence({
      productionAuditPath: join(dir, "release-audit-production.json"),
      dockerImagePath: join(dir, "docker-image-ci.json"),
      dbBackupDir: join(dir, "db-backups"),
      dbMigrationManifestPath: join(dir, "db-migrations", "latest.json"),
      monitoringEvidencePath: join(dir, "monitoring-production.json"),
      now,
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "database_migration_evidence" && !check.ok), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyReleaseEvidence rejects missing production monitoring evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-evidence-"));

  try {
    writeCompleteEvidence(dir);
    rmSync(join(dir, "monitoring-production.json"), { force: true });

    const report = verifyReleaseEvidence({
      productionAuditPath: join(dir, "release-audit-production.json"),
      dockerImagePath: join(dir, "docker-image-ci.json"),
      dbBackupDir: join(dir, "db-backups"),
      dbMigrationManifestPath: join(dir, "db-migrations", "latest.json"),
      monitoringEvidencePath: join(dir, "monitoring-production.json"),
      now,
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "production_monitoring_evidence" && !check.ok), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyReleaseEvidence rejects stale production release evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-evidence-"));

  try {
    writeCompleteEvidence(dir, { checkedAt: staleEvidenceTime });

    const report = verifyReleaseEvidence({
      productionAuditPath: join(dir, "release-audit-production.json"),
      dockerImagePath: join(dir, "docker-image-ci.json"),
      dbBackupDir: join(dir, "db-backups"),
      dbMigrationManifestPath: join(dir, "db-migrations", "latest.json"),
      monitoringEvidencePath: join(dir, "monitoring-production.json"),
      now,
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks.some((check) => check.name === "production_release_audit" && check.detail?.includes("older than")), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeCompleteEvidence(
  dir: string,
  auditOverride?: Record<string, unknown>,
  dockerImageOverride?: unknown,
  backupManifestOverride?: Record<string, unknown>,
  migrationManifestOverride?: Record<string, unknown>,
) {
  mkdirSync(join(dir, "db-backups"), { recursive: true });
  mkdirSync(join(dir, "db-migrations"), { recursive: true });
  writeFileSync(
    join(dir, "release-manifest.json"),
    `${JSON.stringify(
      {
        releaseId: "github-123-a".replace("a", currentRevision.slice(0, 12)),
        commitSha: currentRevision,
        deployBaseUrl: "https://app.live2d-prod.com",
        createdAt: currentEvidenceTime,
        workflow: {
          provider: "github_actions",
          repository: "example/live2d-creator-platform",
          runId: "123",
          runAttempt: "1",
          runUrl: "https://github.com/example/live2d-creator-platform/actions/runs/123",
        },
        artifactPaths: {
          productionAudit: join(dir, "release-audit-production.json"),
          dockerImage: join(dir, "docker-image-ci.json"),
          databaseBackupManifest: join(dir, "db-backups", "latest.json"),
          databaseMigrationManifest: join(dir, "db-migrations", "latest.json"),
          monitoringEvidence: join(dir, "monitoring-production.json"),
        },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(dir, "db-migrations", "latest.json"),
    `${JSON.stringify(
      {
        status: "applied",
        command: "prisma migrate deploy",
        schema: "prisma/schema.prisma",
        backupManifestPath: join(dir, "db-backups", "latest.json"),
        startedAt: currentEvidenceTime,
        finishedAt: currentEvidenceTime,
        createdAt: currentEvidenceTime,
        ...migrationManifestOverride,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(dir, "release-audit-production.json"),
    `${JSON.stringify(
      {
        ok: true,
        checkedAt: currentEvidenceTime,
        requireProduction: true,
        checks: [
          { name: "production_env_validate", required: true, ok: true },
          { name: "production_post_deploy_verify", required: true, ok: true },
          { name: "production_browser_qa_env", required: true, ok: true },
          { name: "production_browser_qa", required: true, ok: true },
        ],
        ...auditOverride,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(dir, "docker-image-ci.json"),
    `${JSON.stringify(
      dockerImageOverride ?? [
        {
          Id: "sha256:abc",
          Created: currentEvidenceTime,
          RepoTags: ["live2d-creator-platform-web:ci"],
          Config: {
            Labels: {
              "org.opencontainers.image.revision": currentRevision,
              "org.opencontainers.image.source": "https://github.com/example/live2d-creator-platform",
            },
          },
        },
      ],
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(dir, "db-backups", "latest.json"),
    `${JSON.stringify(
      {
        backupPath: "artifacts/db-backups/live2d-20260606.dump",
        format: "pg_dump_custom",
        sizeBytes: 128,
        sha256: "a".repeat(64),
        createdAt: currentEvidenceTime,
        ...backupManifestOverride,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(dir, "monitoring-production.json"),
    `${JSON.stringify(
      {
        ok: true,
        checkedAt: currentEvidenceTime,
        deployBaseUrl: "https://app.live2d-prod.com",
        scrape: {
          metricsJob: {
            job: "live2d-web",
            up: true,
            sampleCount: 32,
          },
          fullReadinessProbe: {
            job: "live2d-health-full",
            success: true,
            target: "https://app.live2d-prod.com/api/health?mode=full",
          },
        },
        alerts: requiredProductionMonitoringAlerts.map((name, index) => ({
          name,
          status: "fired_and_resolved",
          firedAt: `2026-06-06T00:0${index}:00.000Z`,
          resolvedAt: `2026-06-06T00:1${index}:00.000Z`,
        })),
      },
      null,
      2,
    )}\n`,
  );
}
