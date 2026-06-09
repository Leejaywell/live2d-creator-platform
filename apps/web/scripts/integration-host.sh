#!/bin/sh
set -eu

POSTGRES_CONTAINER="live2d-integration-postgres"
PIDS=""

cleanup() {
  for pid in $PIDS; do
    kill "$pid" 2>/dev/null || true
  done
  docker rm -f "$POSTGRES_CONTAINER" >/dev/null 2>&1 || true
}

start_node_service() {
  PORT="$1" node "$2" &
  PIDS="$PIDS $!"
}

wait_http() {
  url="$1"
  for _ in $(seq 1 60); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return
    fi
    sleep 1
  done
  echo "Timed out waiting for $url" >&2
  exit 1
}

wait_postgres() {
  for _ in $(seq 1 60); do
    if docker exec "$POSTGRES_CONTAINER" pg_isready -U live2d -d live2d_creator_platform >/dev/null 2>&1; then
      return
    fi
    sleep 1
  done
  echo "Timed out waiting for Postgres" >&2
  exit 1
}

trap cleanup EXIT INT TERM

docker rm -f "$POSTGRES_CONTAINER" >/dev/null 2>&1 || true
docker run -d \
  --name "$POSTGRES_CONTAINER" \
  -e POSTGRES_USER=live2d \
  -e POSTGRES_PASSWORD=live2d \
  -e POSTGRES_DB=live2d_creator_platform \
  -p 55432:5432 \
  postgres:16-alpine >/dev/null

start_node_service 4010 scripts/fake-openai-server.mjs
start_node_service 4020 scripts/fake-redis-rest-server.mjs
PORT=19000 node scripts/fake-s3-server.mjs &
PIDS="$PIDS $!"
SMTP_PORT=1025 API_PORT=8025 node scripts/fake-smtp-mailpit-server.mjs &
PIDS="$PIDS $!"

wait_postgres
wait_http "http://localhost:4010/health"
wait_http "http://localhost:4020/health"
wait_http "http://localhost:19000/health"
wait_http "http://localhost:8025/health"

set -a
. ./.env.integration.host
set +a

prisma migrate deploy
tsx scripts/readiness.ts --app-env-file .env.integration.host --full
tsx scripts/integration-e2e.ts --app-env-file .env.integration.host
