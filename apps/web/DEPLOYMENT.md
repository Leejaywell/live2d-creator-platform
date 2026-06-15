# Deployment Runbook

This app is the production foundation for the Live2D Creator Platform MVP. It is not yet the full product UI.

## Required Services

- PostgreSQL database.
- OpenAI-compatible chat completions provider.
- Object storage for Live2D model zips, extracted model assets, audio, avatars, and generated signed URLs.

## Required Environment

Copy `.env.example` and provide production values:

```bash
DATABASE_URL=
DEPLOY_BASE_URL=
AUTH_SECRET=
AUTH_URL=
FAN_CODE_HASH_SECRET=
PAYMENT_WEBHOOK_SECRET=
PAYMENT_CHECKOUT_URL_TEMPLATE=
OPENAI_COMPATIBLE_BASE_URL=
OPENAI_COMPATIBLE_API_KEY=
OPENAI_COMPATIBLE_MODEL=
MAX_LIVE2D_ZIP_BYTES=
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_REGION=
OBJECT_STORAGE_ACCESS_KEY_ID=
OBJECT_STORAGE_SECRET_ACCESS_KEY=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_FORCE_PATH_STYLE=
ASSET_SIGNED_URL_TTL_SECONDS=
ASSET_PROXY_MODE=
RATE_LIMIT_BACKEND=
REDIS_REST_URL=
REDIS_REST_TOKEN=
METRICS_BEARER_TOKEN=
CSP_REPORT_ONLY=
CSP_REPORT_URI=
CSP_CONNECT_SRC=
CSP_SCRIPT_SRC=
ENABLE_HSTS=
```

Use long random values for `AUTH_SECRET`, `FAN_CODE_HASH_SECRET`, and `PAYMENT_WEBHOOK_SECRET`. Never reuse staging secrets in production.

`PAYMENT_CHECKOUT_URL_TEMPLATE` is optional. When set, creator self-service checkout responses include that URL with `{orderId}` replaced by the pending order id; payment confirmation still requires the signed `/api/payments/webhook` callback.

Validate the production environment file before running migrations or provider readiness:

```bash
npm run env:validate:production
```

This static check rejects missing variables, placeholder/example values, weak secrets, unsafe URL schemes, and non-production modes for rate limiting, CSP, and HSTS. It does not contact databases or external providers; full readiness below performs those network checks.

## Database

```bash
npm run db:generate
npm run db:backup
npm run db:migrate:production
npm run db:seed
```

`db:seed` creates a first Super Admin, Creator, active plan, published demo project, and starter trigger tags.

Set these values before seeding production:

```bash
SEED_SUPER_ADMIN_USERNAME=
SEED_SUPER_ADMIN_PASSWORD=
SEED_CREATOR_USERNAME=
SEED_CREATOR_PASSWORD=
```

When `NODE_ENV=production`, `db:seed` refuses to run unless both usernames and passwords are explicitly set. Local development keeps `admin` and `creator` defaults for convenience.

`db:migrate:production` refuses `SKIP_DB_BACKUP=true`, creates a `pg_dump --format=custom` backup under `artifacts/db-backups/`, writes `artifacts/db-backups/latest.json` with size and SHA-256 evidence, runs `prisma migrate deploy`, then writes `artifacts/db-migrations/latest.json`. Keep the dump in a restricted backup store; the release record only needs the manifests. To restore a backup into a replacement database, use:

```bash
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$DATABASE_URL" artifacts/db-backups/<backup-file>.dump
```

## Container Image

The app includes a production Dockerfile that builds the Next.js standalone server.

```bash
npm run docker:build
```

If Docker Hub metadata pulls are unavailable in the build environment, use an equivalent Node 22 Alpine mirror without changing the runtime image contents:

```bash
NODE_IMAGE=public.ecr.aws/docker/library/node:22-alpine npm run docker:build
```

`docker:build` times out each base-image attempt and falls back to `public.ecr.aws/docker/library/node:22-alpine` by default. Set `DOCKER_IMAGE_TAG`, `DOCKER_IMAGE_REVISION`, `DOCKER_IMAGE_SOURCE_URL`, `DOCKER_BUILD_TIMEOUT_SECONDS`, or `NODE_IMAGE_FALLBACK` when your production build environment needs explicit values.

The Docker build stage uses a non-secret placeholder `DATABASE_URL` only so Prisma can generate the client in clean CI/container build environments. Runtime database credentials must still be provided by the deployment platform.

Run database migrations before starting a new production image:

```bash
npm run db:migrate:production
```

The container starts the generated standalone server on `PORT=3000`. Provide the required environment variables through the deployment platform rather than baking `.env` files into the image.

For non-container local production smoke tests, run `npm run build` and then `npm start`; the start script runs `.next/standalone/server.js`.

## Build Gates

```bash
npm run release:verify
```

`release:verify` runs the local release gate set:

- Prisma schema validates.
- Node service tests pass.
- ESLint passes.
- Next.js production build passes.
- Next.js standalone output is present and does not retain copied `.env` files.
- Docker deployment files are present.
- Docker build has a non-secret Prisma `DATABASE_URL` placeholder for clean image builds.
- CI workflow production audit environment mapping is complete.
- Production environment validator entrypoint is loadable.
- High-severity production dependency audit passes.
- Docker compose integration config is parseable.
- Integration shell script syntax is valid.
- Integration E2E script entrypoint is loadable.
- Production seed refuses to run with default/example admin and creator credentials.

Basic readiness checks are also available through `npm run readiness` and `/api/health`.

GitHub Actions runs the same quality gates on push and pull request, then runs `npm run integration:ci` on Ubuntu with Docker. The Docker build job uploads `artifacts/docker-image-ci.json` from `docker image inspect` so the release record includes image-build metadata. The workflow also supports manual post-deploy verification through `workflow_dispatch`; set repository secret `METRICS_BEARER_TOKEN` and provide `deploy_base_url` for health/metrics/CSP verification. For browser QA, either set repository secret `QA_FAN_CODE` or let the workflow run `qa:provision`; provide `qa_base_url`, `qa_project_slug`, and `qa_expect_live2d` inputs. The `run_release_audit` workflow option waits for quality, integration, and production Docker image build jobs, downloads the Docker image evidence, runs `db:migrate:production`, prepares `.env.qa.release` from `qa:env:write` or `qa:provision`, writes `MONITORING_EVIDENCE_JSON` to `artifacts/monitoring-production.json` or collects it from `PROMETHEUS_BASE_URL` plus `MONITORING_ALERTS_JSON` or `ALERTMANAGER_BASE_URL`, runs the final production audit, writes `artifacts/release-manifest.json`, verifies the complete release evidence bundle, and uploads `artifacts/release-manifest.json`, `artifacts/release-audit-production.json`, `artifacts/docker-image-ci.json`, `artifacts/db-backups/latest.json`, `artifacts/db-migrations/latest.json`, and `artifacts/monitoring-production.json`; it requires all production environment names from `.env.example` to be configured as GitHub Actions repository secrets or variables.

Run the full provider readiness check after production secrets are configured:

```bash
npm run release:verify:full -- --app-env-file .env.production
npm run readiness:full
curl -fsS "https://your-domain.example/api/health?mode=full"
```

Full readiness verifies:

- Strong non-placeholder auth and fan-code secrets.
- PostgreSQL connectivity.
- Object storage put/get/signed URL/delete round trip.
- SMTP connection verification.
- OpenAI-compatible chat completion connectivity.
- Redis/Upstash-compatible rate-limit backend connectivity when `RATE_LIMIT_BACKEND=redis`.
- Security header mode, including enforced CSP and HSTS in production.

Run post-deploy browser QA after seeding or provisioning a real published project and fan code:

```bash
npm run env:validate:production
npm run post-deploy:verify -- --app-env-file .env.production
npm run qa:provision -- --app-env-file .env.production --write-env .env.qa
npm run browser:install
npm run browser:qa
npm run release:audit:production
npm run release:manifest:write
npm run release:evidence:verify
```

In GitHub Actions or another environment where production and QA values are injected as environment variables instead of files, run:

```bash
npm run release:audit:production -- --production-env-file /dev/null --browser-env-file /dev/null
```

Use `.env.provision.example` as the provisioning template. Set `QA_MODEL_ZIP_PATH` to an actual local Live2D Cubism zip, or set `QA_MODEL_ZIP_URL` to an HTTPS model zip artifact plus `QA_MODEL_ZIP_SHA256`, when the QA gate must prove the renderer against real model assets. `qa:provision` writes `.env.qa` with a fresh plaintext fan code because fan-code plaintext is intentionally not stored.

Browser QA verifies:

- Public audience page loads.
- Fan-code validation reaches an active chat session.
- Chat returns an assistant reply.
- Live2D canvas is visible and, when `QA_EXPECT_LIVE2D=true`, nonblank.

Final production release audit runs browser QA with `--require-production`, so `QA_EXPECT_LIVE2D` must be `true`; a release audit without real Live2D rendering evidence is rejected.

Final release evidence verification requires all of these retained artifacts:

- `artifacts/release-manifest.json` from `npm run release:manifest:write`. It binds the release id, commit SHA, production URL, GitHub Actions run metadata, and the retained evidence paths; Docker OCI revision evidence must match this commit.
- `artifacts/release-audit-production.json` from `npm run release:audit:production`.
- `artifacts/docker-image-ci.json` from `docker image inspect live2d-creator-platform-web:ci`. The inspected image must include OCI `org.opencontainers.image.revision` and `org.opencontainers.image.source` labels; CI matches the revision to `github.sha`.
- `artifacts/db-backups/latest.json` from the production `pg_dump` backup step. Raw dump files alone are not accepted as final release evidence; the dump itself should stay in a restricted backup store, not in a general CI artifact.
- `artifacts/db-migrations/latest.json` from the successful `prisma migrate deploy` step.
- `artifacts/monitoring-production.json` proving production metrics scrape, full readiness probe, and every alert fired and resolved.

By default, `npm run release:evidence:verify` rejects evidence older than 24 hours. Use `-- --max-age-hours <hours>` only when the release owner has approved a longer evidence window.

Post-deploy verification checks:

- `/api/health` basic readiness.
- `/api/health` service metadata, including `NODE_ENV=production`.
- `/api/health?mode=full` provider readiness.
- Homepage response headers, including enforced CSP, frame denial, nosniff, referrer policy, permissions policy, and HSTS for HTTPS deployments.
- `/api/metrics` rejects unauthenticated requests.
- `/api/metrics` can be scraped with `METRICS_BEARER_TOKEN`.
- `/api/csp-report` accepts CSP violation reports.

For repeatable CI or local staging without real provider accounts, run the integration stack:

```bash
npm run release:verify:full
```

CI can use `npm run integration:ci` to start dependencies, migrate, run full readiness, run the database-backed E2E flow, and tear containers down with a shell trap. The integration stack starts PostgreSQL, MinIO, Mailpit, a local OpenAI-compatible fake chat service, and an Upstash-compatible fake Redis REST service. It uses `.env.integration` and validates the same object storage, SMTP, AI, Redis rate-limit, and database code paths as production readiness.

If Docker Compose cannot pull all service images in a local environment, `npm run integration:host` starts only PostgreSQL in Docker and runs host-side fake SMTP/Mailpit, S3, OpenAI, and Redis-compatible services from `scripts/`. It uses `.env.integration.host` and runs the same full readiness and E2E scripts.

For a single local command that includes the release gate and host integration stack:

```bash
npm run release:verify:host
```

For a local final evidence audit that also includes host browser QA:

```bash
npm run release:audit:host
```

Audit commands write JSON evidence under `artifacts/`; keep the production audit JSON with the release record.

For local browser QA against the host integration stack:

```bash
npm run build
npm run browser:qa:host
```

This provisions a published QA project without a model and verifies the audience page, fan-code validation, and chat in a real browser. Production browser QA should still run with a real `QA_MODEL_ZIP_PATH` or HTTPS `QA_MODEL_ZIP_URL` plus `QA_MODEL_ZIP_SHA256`, and `QA_EXPECT_LIVE2D=true`, to prove the Live2D renderer.

`integration:e2e` verifies:

- Creator, plan, project, and trigger tag creation.
- First-party password login and database session creation.
- Fan-code generation.
- Fan-code validation and viewer session creation.
- AI proxy call.
- Successful chat quota deduction.
- Chat usage and quota ledger writes.

`/api/health` also includes service metadata such as service name, version, commit SHA when provided by the platform, runtime environment, and uptime.

For production, set:

```bash
RATE_LIMIT_BACKEND=redis
REDIS_REST_URL=
REDIS_REST_TOKEN=
```

If `NODE_ENV=production` and the app is still configured with memory rate limiting, readiness fails because memory limits are not safe across multiple app instances.

For observability, configure your monitoring system to scrape:

```bash
curl -H "Authorization: Bearer $METRICS_BEARER_TOKEN" \
  "https://your-domain.example/api/metrics"
```

A Prometheus scrape example is versioned in `monitoring/prometheus-scrape.example.yml`. Replace `your-domain.example` with the production host and mount `METRICS_BEARER_TOKEN` at `/etc/prometheus/secrets/live2d_metrics_bearer_token`. The example also includes a blackbox exporter probe for `/api/health?mode=full`.

Recommended alerts:

- `/api/health?mode=full` returns non-2xx.
- `live2d_http_requests_total{status=~"5.."}` increases.
- `live2d_rate_limit_rejections_total` spikes above expected traffic.
- `live2d_csp_violations_total` increases after CSP is expected to be stable.
- `live2d_http_request_duration_seconds_bucket` shows elevated latency on `/api/chat`.

Prometheus-compatible alert rules are versioned in `monitoring/prometheus-rules.yml`. Validate the scrape example and alert rules with:

```bash
npm run monitoring:verify
```

Before final release, create `artifacts/monitoring-production.json`. When a Prometheus-compatible API is available, collect the scrape/probe evidence directly and merge it with retained alert fire/resolution evidence:

```bash
PROMETHEUS_BASE_URL=https://prometheus.example.com \
DEPLOY_BASE_URL=https://your-domain.example \
MONITORING_ALERTS_JSON="$(cat artifacts/alert-evidence.json)" \
npm run monitoring:evidence:collect
```

`MONITORING_ALERTS_JSON` may also be provided with `--alert-evidence artifacts/alert-evidence.json`; it can be either an alert array or an object with `alerts[]`. If Alertmanager retains resolved alerts, use `ALERTMANAGER_BASE_URL` or `--alertmanager-url` instead of manually retained alert JSON; active alerts are ignored and do not count as fired-and-resolved evidence. The generated evidence is immediately checked by the same verifier used by the release gate. If your monitoring provider cannot expose a Prometheus-compatible query API, create the file using `monitoring/production-evidence.example.json` as the shape. It must prove:

- `live2d-web` metrics scrape is up with samples.
- `live2d-health-full` blackbox probe succeeds against the production `/api/health?mode=full`.
- Every alert in `monitoring/prometheus-rules.yml` has fired and resolved at least once.

Validate the retained monitoring evidence with:

```bash
npm run monitoring:evidence:verify
```

To apply the same freshness rule outside the final release gate:

```bash
npm run monitoring:evidence:verify -- --max-age-hours 24
```

Security headers:

- CSP is enforced by default and allows the Live2D runtime script domains used by the renderer.
- `CSP_REPORT_ONLY=true` is allowed for staging but fails readiness in production.
- `CSP_REPORT_URI` defaults to `/api/csp-report`; production readiness requires a same-origin path or HTTPS URL.
- `CSP_CONNECT_SRC` and `CSP_SCRIPT_SRC` can append comma-separated source expressions if a deployment adds trusted providers.
- HSTS is emitted automatically in production. `ENABLE_HSTS=true` can force it in staging.

Authentication:

- Password-login sessions are stored in the Prisma `Session` table with hashed session tokens.
- Creator accounts are created by admins and can change their own password after signing in.

## Implemented API Surface

- `POST /api/model-assets/validate`
  - Authenticated model zip validation.
- `GET /api/assets/signed`
  - Authenticated or viewer-session authorized signed URL generation for protected model/audio assets.
- `GET /api/assets/proxy`
  - Authenticated or viewer-session authorized asset proxy. `ASSET_PROXY_MODE=redirect` returns a short-lived signed URL redirect; `ASSET_PROXY_MODE=stream` streams the object through the app.
- `GET /api/assets/live2d-model`
  - Viewer-session authorized model3.json response with Live2D file references rewritten through the protected asset proxy.
- `POST /api/admin/creators`
  - Admin creator account creation/upsert.
- `POST /api/admin/users`
  - Super Admin admin-user creation/upsert for Super Admin, Ops Admin, and Support Admin roles.
- `POST /api/admin/orders`
  - Admin manual order creation.
- `POST /api/admin/orders/[orderId]/confirm`
  - Admin order confirmation with plan/quota ledger writes.
- `POST /api/admin/orders/[orderId]/void`
  - Admin pending-order voiding.
- `POST /api/admin/orders/[orderId]/refund`
  - Admin confirmed-order refund marking. Reverses unused quota and writes negative ledger entries.
- `POST /api/admin/projects/[projectId]/status`
  - Admin project pause/restore/status control.
- `POST /api/admin/projects/[projectId]/model-assets`
  - Admin-assisted Live2D zip upload, validation, storage, and current model update.
- `POST /api/creator/projects`
  - Authenticated creator project creation.
- `PATCH /api/creator/projects/[projectId]`
  - Authenticated creator project updates.
- `POST /api/creator/projects/[projectId]/publish`
  - Authenticated creator project status updates.
- `POST /api/creator/projects/[projectId]/tags`
  - Authenticated trigger tag creation.
- `PATCH|DELETE /api/creator/projects/[projectId]/tags/[tagId]`
  - Authenticated trigger tag updates, deletion, and voice asset binding.
- `POST /api/creator/projects/[projectId]/tags/test`
  - Authenticated sample-message trigger test that returns the matched tags, Live2D parameter effects, and bound voice asset references without deducting fan-code or plan quota.
- `POST /api/creator/projects/[projectId]/voice-assets`
  - Authenticated voice asset binary upload or metadata creation.
- `PATCH|DELETE /api/creator/projects/[projectId]/voice-assets/[voiceAssetId]`
  - Authenticated voice asset metadata/status updates, binary replacement, and soft delete.
- `POST /api/creator/projects/[projectId]/model-assets`
  - Authenticated Live2D zip upload, validation, extraction, protected object storage write, ModelAsset persistence, and current model update.
- `POST /api/creator/projects/[projectId]/model-assets/rollback`
  - Authenticated rollback to a previous valid Live2D model version.
- `POST /api/creator/checkout`
  - Authenticated creator self-service checkout order creation in provider checkout modes. Creates a pending order from a supported SKU and returns an optional checkout URL when `PAYMENT_CHECKOUT_URL_TEMPLATE` is configured.
- `DELETE /api/creator/checkout/[orderId]`
  - Authenticated creator cancellation for the creator's own pending self-service checkout order.
- `POST /api/creator/fan-codes`
  - Authenticated creator fan-code batch generation. The creator UI immediately exports plaintext codes as CSV because plaintext is not stored.
- `DELETE /api/creator/fan-codes/[codeId]`
  - Authenticated creator fan-code revocation for a single access code.
- `DELETE /api/creator/fan-codes/batches/[batchId]`
  - Authenticated creator fan-code batch revocation.
- `POST /api/fan-codes/validate`
  - Rate-limited public fan-code validation and browser-device binding.
- `POST /api/chat`
  - Rate-limited public viewer-session chat proxy with quota deduction after successful AI response. Returns triggered tags, configured Live2D parameter effects, and protected voice asset proxy URLs for active voice assets bound to those tags.
- `POST /api/auth/signin`
  - Verifies username/password credentials for active users, creates a database session, and sets the HTTP-only session cookie.
- `GET|POST /api/auth/signout`
  - Deletes the current database session and clears the session cookie.
- `GET /api/health`
  - Deployment readiness report. `mode=basic` checks env/secrets/database; `mode=full` also verifies object storage, SMTP, and AI provider connectivity.
- `GET /api/metrics`
  - Prometheus-compatible metrics endpoint. Requires `Authorization: Bearer $METRICS_BEARER_TOKEN` when configured, and refuses unauthenticated production exposure.
- `POST /api/csp-report`
  - CSP violation report sink. Records structured logs and increments `live2d_csp_violations_total`.
- `POST /api/payments/webhook`
  - Provider checkout callback. Requires `x-live2d-payment-signature` as an HMAC-SHA256 signature using `PAYMENT_WEBHOOK_SECRET`; confirmed matching events update orders, quota, and ledger entries.

## Remaining Production Work

- Run `npm run env:validate:production` against real `.env.production`.
- Run `npm run release:verify:full -- --app-env-file .env.production` after real provider secrets are configured.
- Build the production Docker image in CI or another environment that can pull `node:22-alpine`.
- Execute `qa:provision` and `browser:qa` against real uploaded Live2D model assets in a configured storage/database environment.
- Execute `integration:ci` in an environment with Docker daemon or equivalent real services.
- Run `npm run post-deploy:verify -- --app-env-file .env.production`, wire `/api/health` and `/api/metrics` into the production monitoring provider, verify alerts fire and resolve, and retain `artifacts/monitoring-production.json`.
- Verify `live2d_csp_violations_total` and CSP violation logs in the production browser QA environment.
- Run `npm run release:audit:production` and keep `artifacts/release-audit-production.json` with the release evidence.
- Run `npm run release:evidence:verify` against the retained release manifest, production audit, Docker image inspect output, database backup manifest, database migration manifest, and production monitoring evidence.

## Implemented Pages

- `/sign-in`
  - Auth entrypoint.
- `/creator`
  - Creator plan/project dashboard plus project creation, self-service checkout entry, billing history, usage analytics, and links to each project management page.
- `/creator/projects/[projectId]`
  - Per-project management page for settings, status, model upload/version rollback, trigger tag create/edit/delete/binding/testing, voice upload/update/replacement/disable, and fan-code CSV generation/export/status/revocation.
- `/admin`
  - Admin dashboard with admin-user, creator, order, project, diagnostics, and forms for admin user upsert, creator creation, manual orders, order confirmation, project status, and admin-assisted model upload.
- `/c/[slug]`
  - Public audience page with fan-code validation, backend chat proxy integration, configured tag-driven Live2D parameter effects, triggered voice playback, and PixiJS/pixi-live2d-display rendering after access is granted.
