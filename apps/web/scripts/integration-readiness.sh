#!/bin/sh
set -eu

cleanup() {
  docker compose -f docker-compose.integration.yml down
}

trap cleanup EXIT INT TERM

docker compose -f docker-compose.integration.yml up -d --wait
set -a
. ./.env.integration
set +a
prisma migrate deploy
tsx scripts/readiness.ts --app-env-file .env.integration --full
tsx scripts/integration-e2e.ts --app-env-file .env.integration
