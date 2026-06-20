# Live2D Creator Platform

A platform where **creators** upload a Live2D model, give it an AI persona + trigger
tags + voice lines, and hand out **fan access codes**; **audiences** enter with a code
and chat in real time with the AI‑driven character (expressions, parameters, and voice
react to the conversation); **admins** run the platform (AI provider, content moderation,
plans, billing, model assistance).

> Single‑model‑first MVP. The whole app lives in [`apps/web`](apps/web).

- 📋 Product requirements: [`docs/PRD.md`](docs/PRD.md)
- ✅ Feature status (done / not done): [`docs/FEATURES.md`](docs/FEATURES.md)

---

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js **16** (App Router, Turbopack, `proxy.ts`) |
| UI | React **19**, TypeScript, CSS Modules |
| i18n | `next-intl` — 中文 / English / 日本語 |
| Live2D | PixiJS 7 + `pixi-live2d-display` (cubism4), **self‑hosted** under `public/vendor` |
| ORM | Prisma **7** with driver adapters |
| DB (local) | **PGlite** — in‑process, file‑backed Postgres (no server, no Docker) |
| DB (prod) | PostgreSQL (same schema, via `@prisma/adapter-pg`) |
| Object storage | **Local filesystem** in dev (`.local-storage/`); S3‑compatible in prod |
| Validation | zod |
| Tests | `node:test` (`node --import tsx`) |
| AI | OpenAI‑compatible providers via a server‑side proxy (key never reaches the client) |

---

## Quick start

Prereqs: **Node 22+** (24 recommended), npm. No database server and no Docker required —
local dev uses PGlite (a file DB).

```bash
cd apps/web
npm install
npm run db:push            # create/reset the local schema in ./.pglite
npm run db:seed            # seed: super admin, a creator, a sample project
npm run setup:showroom     # optional: 'showroom' creator + the 4 demo models as published projects
npm run setup:entry        # optional: swap the seeded entry-test project (urzis) to the 爱宕 (Atago) model
npm run dev                # http://localhost:3000
```

> `setup:showroom` publishes the four bundled demo characters (圣路易斯 / 贝尔法斯特 /
> 爱宕 / 埃吉尔) under a `showroom` creator so the landing-page models are viewable —
> with the full showroom controls **and** AI chat — on the audience (`/c/<slug>`) and
> creator-preview pages. `setup:entry` gives the seeded `creator` account's `urzis`
> project the 爱宕 (Atago) onee-san model — outfit, motions, **authored facial
> expressions** (`public/live2d/aidang_2/expressions/*.exp3.json`), and voice. Both
> print fan codes. **Stop the dev server before running DB scripts** — PGlite is
> single-process; these scripts force a clean exit so they don't hold the lock.

On the sign‑in page (`/sign-in`) the dev build shows **Admin** and **Creator** shortcut
buttons (seed accounts; default password `ChangeMe123!`).

### How the local DB works

`src/lib/prisma.ts` picks the adapter at runtime:

- `PGLITE_DATA_DIR` set (default in `.env` → `./.pglite`) ⇒ **PGlite** (local file DB).
- otherwise ⇒ **PostgreSQL** via `DATABASE_URL`.

There is **no Prisma migration history**. The schema is applied directly:

- `npm run db:push` renders `prisma/schema.prisma` to SQL and applies it to PGlite **(resets data)**.
- After a schema change, run `db:push` then `db:seed`.

---

## Scripts

| Command (run in `apps/web`) | What it does |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / standalone start |
| `npm run db:push` | Apply the schema to the local PGlite DB (resets data) |
| `npm run db:seed` | Seed baseline accounts + sample project |
| `npm run db:generate` | `prisma generate` |
| `npm test` | Unit tests (`tests/*.test.ts`) |
| `npm run lint` | ESLint |

---

## Project layout

```
apps/web/
├─ prisma/
│  ├─ schema.prisma        # single source of truth (no migrations dir)
│  └─ seed.ts
├─ scripts/
│  └─ pglite-push.ts       # local "db push" for PGlite
├─ public/
│  ├─ vendor/              # self-hosted PixiJS + pixi-live2d-display
│  ├─ live2dcubismcore.min.js
│  └─ live2d/              # demo character models + voice/audio config
├─ src/
│  ├─ app/
│  │  ├─ page.tsx          # landing + interactive Live2D demo
│  │  ├─ c/[slug]/         # audience: fan-code gate + AI chat
│  │  ├─ creator/          # creator workbench (1 model)
│  │  ├─ admin/            # admin console
│  │  └─ api/              # route handlers (chat, fan-codes, projects, admin…)
│  ├─ components/          # landing-demo, desktop-pet, live2d-viewer, audience-chat…
│  ├─ lib/                 # services: ai-proxy, fan-code-service, projects, prisma…
│  ├─ i18n/messages/       # zh.json / en.json / ja.json
│  └─ proxy.ts             # per-request CSP nonce (Next 16 "proxy" convention)
```

---

## Architecture notes

- **Three surfaces.** Landing/demo (`/`), audience viewer (`/c/[slug]`), creator workbench
  (`/creator`), admin console (`/admin`). Auth is username + password with server‑side
  sessions; routes/mutations are authorized server‑side (never UI‑gated).
- **AI proxy** (`src/lib/ai-proxy.ts`). All chat goes through a server proxy to an
  OpenAI‑compatible provider. The API key lives only on the server; the client never sees
  it. Provider + base URL + model + key are configured in **Admin → Settings → AI** (25
  built‑in China/international provider presets — pick one, paste a key).
- **Fan codes & quota** (`src/lib/fan-code-service.ts`). Codes are device‑bindable, have an
  expiry and a per‑code message cap. Chat quota is reserved **before** the paid AI call and
  refunded on failure; the creator's monthly AI limit is enforced atomically. Device binding
  is re‑verified on every message.
- **Live2D runtime** is self‑hosted (no CDN). PixiJS owns its canvas inside a React host
  div; tap reactions use `model.hitTest` (the library's `hit` event is broken on Pixi 7).
- **Security.** Per‑request CSP **nonce** via `src/proxy.ts` (no `'unsafe-inline'` for
  scripts); rate limits on chat, sign‑in, uploads, fan‑code/project/tag/checkout creation;
  input safety + output moderation on chat; zip‑bomb / upload‑size guards; audit log on
  privileged actions.
- **i18n.** All user‑facing strings come from `src/i18n/messages/{zh,en,ja}.json`.

> `apps/web/AGENTS.md` notes that this repo pins a **modified** Next.js — consult
> `node_modules/next/dist/docs` before using an unfamiliar Next API.

---

## Environment

Minimum for local dev (`apps/web/.env`):

```bash
PGLITE_DATA_DIR="./.pglite"     # use the local file DB
STORAGE_DRIVER="local"          # store model assets on the local filesystem (.local-storage/)
AUTH_SECRET="<random>"          # session signing
FAN_CODE_HASH_SECRET="<random>" # fan-code hashing
# Optional (real AI in dev): set the provider in Admin → Settings, or:
# OPENAI_COMPATIBLE_BASE_URL / OPENAI_COMPATIBLE_API_KEY / OPENAI_COMPATIBLE_MODEL
```

Model assets (uploaded Live2D zips, extracted files) go through an object store.
`STORAGE_DRIVER=local` (or simply leaving `OBJECT_STORAGE_BUCKET` unset) writes them
under `.local-storage/` — no S3/MinIO/Docker needed. For production set
`STORAGE_DRIVER=s3` (or just the `OBJECT_STORAGE_*` vars) for an S3‑compatible bucket.

With AI **disabled** (no key configured) chat falls back to canned, keyword‑matched
replies, so the full flow still works offline.

For production, unset `PGLITE_DATA_DIR` and provide a Postgres `DATABASE_URL`; apply the
schema with `prisma db push`.

---

## Testing

```bash
npm test          # all unit tests (quotas, fan codes, safety, validation, readiness…)
npm run lint
```

Unit tests don't need a database. DB‑touching integration scripts live under `scripts/`
and are not part of `npm test`.
