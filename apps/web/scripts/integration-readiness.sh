#!/bin/sh
set -eu

cleanup() {
  docker compose -f docker-compose.integration.yml down
}

trap cleanup EXIT INT TERM

npm run integration:up
set -a
. ./.env.integration
set +a
prisma db push
tsx scripts/readiness.ts --app-env-file .env.integration --full
tsx scripts/integration-e2e.ts --app-env-file .env.integration
