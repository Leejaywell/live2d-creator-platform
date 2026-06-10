# Live2D Creator Platform Web App

Production Next.js app for the Live2D Creator Platform MVP.

## Local Setup

```bash
cp .env.example .env
npm run db:generate
npm run db:dev
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production Checks

```bash
npm run release:verify
```

`release:verify` runs Prisma validation, unit tests, lint, production build, standalone output and environment-leak checks, Docker deployment-file checks, high-severity audit, Docker compose config validation, integration shell/fake-provider syntax checks, the integration E2E entrypoint smoke check, and the production seed default-account guard.

For local integration readiness with real service containers:

```bash
npm run release:verify:full
```

`release:verify:full` defaults to `.env.integration` and runs `integration:ci`, which starts dependencies, migrates, runs full readiness and E2E, and tears containers down. Passing `--app-env-file .env.production` also runs full readiness against the configured production providers.

When Docker Compose image pulls are unavailable but a local Docker context already has `postgres:16-alpine`, `npm run integration:host` runs the same readiness and E2E checks with host-side fake SMTP/S3/OpenAI/Redis services.

Use `npm run release:verify:host` to run the local release gate plus that host integration stack in one command.

Use `npm run browser:qa:host` after `npm run build` to run the audience-page browser QA locally against the host integration stack. It provisions a published QA project without a model and verifies fan-code validation plus chat; real model rendering is still covered by post-deploy `browser:qa` with `QA_MODEL_ZIP_PATH` or `QA_MODEL_ZIP_URL`.

Use `npm run release:audit:host` for the local final evidence audit. Use `npm run release:audit:production` only after `.env.production` and `.env.qa` contain real deployed-provider and Live2D QA values. Production release audit requires `QA_EXPECT_LIVE2D=true`, so it must prove a nonblank Live2D canvas. In CI, pass `--production-env-file /dev/null --browser-env-file /dev/null` so the audit uses injected secrets and QA inputs. Audit JSON is written under `artifacts/`.

After the production audit, run `npm run release:manifest:write` and then `npm run release:evidence:verify` against the retained release artifacts. It requires `artifacts/release-manifest.json`, `artifacts/release-audit-production.json`, `artifacts/docker-image-ci.json`, database backup evidence under `artifacts/db-backups/latest.json`, database migration evidence under `artifacts/db-migrations/latest.json`, and production monitoring evidence under `artifacts/monitoring-production.json`. Docker evidence must include OCI source and revision labels, and CI matches the revision to the current commit. Evidence must be no older than 24 hours by default; override with `--max-age-hours` only when the release policy explicitly allows it. The backup manifest records size and SHA-256 so CI can retain proof without uploading the production dump itself.

Before connecting to real providers, validate production environment shape locally:

```bash
npm run env:validate:production
```

Build the production container image with:

```bash
npm run docker:build
```

If Docker Hub is unavailable in the build environment, use an equivalent Node 22 Alpine mirror:

```bash
NODE_IMAGE=public.ecr.aws/docker/library/node:22-alpine npm run docker:build
```

`docker:build` times out each base-image attempt and falls back to `public.ecr.aws/docker/library/node:22-alpine` by default. Override `DOCKER_IMAGE_TAG`, `DOCKER_IMAGE_REVISION`, `DOCKER_IMAGE_SOURCE_URL`, `DOCKER_BUILD_TIMEOUT_SECONDS`, or `NODE_IMAGE_FALLBACK` when the release environment needs different values.

The image build uses a non-secret Prisma `DATABASE_URL` placeholder; runtime credentials still come from the deployment environment.

After `npm run build`, `npm start` runs the generated Next.js standalone server.

For production database changes, use `npm run db:migrate:production`; it creates a `pg_dump` backup under `artifacts/db-backups/`, writes `artifacts/db-backups/latest.json`, runs `prisma migrate deploy`, and writes `artifacts/db-migrations/latest.json`.

The GitHub Actions workflow runs quality gates, production Docker image build, and integration readiness/E2E on push and pull request. The Docker build job uploads `artifacts/docker-image-ci.json` from `docker image inspect` as build evidence. Manual workflow dispatch can run post-deploy health/metrics/CSP verification with repository secret `METRICS_BEARER_TOKEN`, browser QA with `QA_FAN_CODE` or automatic `qa:provision`, and a final production release audit after the quality, integration, and production Docker image build jobs pass. The final audit job downloads the Docker evidence, runs `db:migrate:production`, prepares `.env.qa.release` from `qa:env:write` or `qa:provision`, writes `artifacts/monitoring-production.json` from `MONITORING_EVIDENCE_JSON` or collects it from `PROMETHEUS_BASE_URL` plus `MONITORING_ALERTS_JSON` or `ALERTMANAGER_BASE_URL`, runs the production audit, writes `artifacts/release-manifest.json`, verifies `release:evidence:verify`, then uploads the retained release evidence bundle. It expects the production environment from `.env.example` to be present as repository secrets or variables.

Post-deploy browser QA uses `.env.qa.example` as a template:

```bash
npm run post-deploy:verify -- --app-env-file .env.production
npm run qa:provision -- --app-env-file .env.production --write-env .env.qa
npm run browser:install
npm run browser:qa
```

`post-deploy:verify` also checks the deployed health metadata for `NODE_ENV=production` and the homepage response headers for enforced CSP plus production browser security headers.

## Implemented Foundation

- Prisma PostgreSQL schema covering users, roles, plans, manual orders, quota ledger, projects, model assets, voice assets, trigger tags, fan codes, viewer sessions, chat usage, voice clone requests, and audit logs.
- First-party email magic-link login backed by Prisma database sessions.
- Role permission helpers for Super Admin, Ops Admin, Support Admin, and Creator.
- Live2D zip validation utility and upload validation API.
- Fan-code generation, hashing, device binding, validation, and quota deduction services.
- OpenAI-compatible backend chat proxy with structured `reply`/`tags` handling and fallback behavior.
- Admin dashboard for admin users, creators, manual orders, project status, paused clone-request review, and audit visibility.
- Creator dashboard and per-project management pages for project settings, model upload, trigger tag editing/binding, voice asset upload/replacement/management, fan-code CSV export, and mode-gated clone requests that default to disabled.
- Security headers plus lightweight rate limiting for public fan-code validation and chat endpoints.
- Configurable protected asset delivery through signed redirects or app-level streaming.
- Readiness checks for environment, secrets, database, object storage, SMTP, and AI provider connectivity.
- Redis/Upstash-compatible production rate limiting with memory fallback for local development.
- Prometheus-compatible `/api/metrics`, scrape/probe example config, alert rules, and structured JSON operational logs.
- Enforced production CSP/HSTS security headers with readiness checks.

The static prototype remains in `../../prototypes/live2d-companion-clone`.
