#!/bin/sh
set -eu

docker compose -f docker-compose.integration.yml up -d --wait postgres minio mailpit fake-openai fake-redis-rest
docker compose -f docker-compose.integration.yml run --rm create-bucket
