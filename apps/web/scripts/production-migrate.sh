#!/bin/sh
set -eu

if [ "${SKIP_DB_BACKUP:-false}" = "true" ]; then
  echo "SKIP_DB_BACKUP=true is not allowed for production migrations" >&2
  exit 1
fi

BACKUP_PATH="$(sh scripts/db-backup.sh)"
echo "Created database backup: $BACKUP_PATH"

MIGRATION_MANIFEST_PATH="${DB_MIGRATION_MANIFEST_PATH:-artifacts/db-migrations/latest.json}"
BACKUP_MANIFEST_PATH="${DB_BACKUP_MANIFEST_PATH:-artifacts/db-backups/latest.json}"
MIGRATION_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

prisma db push

MIGRATION_FINISHED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
MIGRATION_MANIFEST_PATH="$MIGRATION_MANIFEST_PATH" \
BACKUP_MANIFEST_PATH="$BACKUP_MANIFEST_PATH" \
MIGRATION_STARTED_AT="$MIGRATION_STARTED_AT" \
MIGRATION_FINISHED_AT="$MIGRATION_FINISHED_AT" \
node <<'NODE'
const { mkdirSync, writeFileSync } = require("node:fs");
const { dirname } = require("node:path");

const manifestPath = process.env.MIGRATION_MANIFEST_PATH;
const backupManifestPath = process.env.BACKUP_MANIFEST_PATH;
const startedAt = process.env.MIGRATION_STARTED_AT;
const finishedAt = process.env.MIGRATION_FINISHED_AT;

if (!manifestPath || !backupManifestPath || !startedAt || !finishedAt) {
  throw new Error("Migration manifest environment is incomplete");
}

mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      status: "applied",
      command: "prisma db push",
      schema: "prisma/schema.prisma",
      backupManifestPath,
      startedAt,
      finishedAt,
      createdAt: finishedAt,
    },
    null,
    2,
  )}\n`,
);
NODE
