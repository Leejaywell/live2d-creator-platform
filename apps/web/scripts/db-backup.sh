#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required for production database backups" >&2
  exit 1
fi

BACKUP_DIR="${DB_BACKUP_DIR:-artifacts/db-backups}"
BACKUP_NAME="${DB_BACKUP_NAME:-live2d-$(date -u +%Y%m%dT%H%M%SZ).dump}"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
BACKUP_MANIFEST_PATH="${DB_BACKUP_MANIFEST_PATH:-$BACKUP_DIR/latest.json}"

mkdir -p "$BACKUP_DIR"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file="$BACKUP_PATH"

BACKUP_PATH="$BACKUP_PATH" BACKUP_MANIFEST_PATH="$BACKUP_MANIFEST_PATH" node <<'NODE'
const { createReadStream, mkdirSync, statSync, writeFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { dirname } = require("node:path");

const backupPath = process.env.BACKUP_PATH;
const manifestPath = process.env.BACKUP_MANIFEST_PATH;

if (!backupPath || !manifestPath) {
  throw new Error("BACKUP_PATH and BACKUP_MANIFEST_PATH are required");
}

const hash = createHash("sha256");
const input = createReadStream(backupPath);

input.on("data", (chunk) => hash.update(chunk));
input.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
input.on("end", () => {
  const stats = statSync(backupPath);
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        backupPath,
        format: "pg_dump_custom",
        sizeBytes: stats.size,
        sha256: hash.digest("hex"),
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
});
NODE

printf '%s\n' "$BACKUP_PATH"
