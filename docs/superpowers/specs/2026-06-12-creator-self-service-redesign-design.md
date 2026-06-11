# Creator Self-Service Flow — Refactor & Glass Redesign (Phase 1)

Date: 2026-06-12
Status: Approved (design) — pending implementation plan
Scope: Phase 1 of a phased refactor of the Live2D Creator Platform

## Context

The platform lets streamers configure a Live2D AI companion and share it with
fans via access codes. The backend service layer (`apps/web/src/lib/*`) and
Prisma data layer are mature (172 unit tests pass). The frontend has had one
prior redesign ("Backstage/开演"). The owner wants to refactor the business
flows and the frontend and redesign until the flows run end-to-end.

This is a whole-product effort, so it is decomposed into phases. **This spec
covers Phase 1 only: the creator self-service flow.**

The project has never been released or deployed, so the database schema can be
reshaped freely — changes are direct schema edits + `prisma migrate reset` +
re-seed. No migration/back-compat ceremony is required.

## Goals

- Refactor the creator self-service business flow so a creator can, on their
  own, go from sign-in to a published, usable Live2D companion.
- Rebuild the creator frontend as a new architecture with a brand-new
  "glassmorphism + stage" design system.
- Make the whole creator journey run end-to-end (the "跑通" acceptance gate).

## Decisions (from brainstorming)

- **Overall objective:** all three — business refactor, frontend redesign, and
  end-to-end run-through — delivered in phases.
- **Acceptance environment:** "in between" — the core experience (creator
  config / audience chat) is production-grade; payment stays manual with some
  placeholders; not yet deployed.
- **Phase 1 target:** the creator self-service flow.
- **Business areas to refactor (all four):** self-serve onboarding / plan
  gating; tag↔voice↔expression binding; model upload & validation UX; fan-code
  generation & distribution.
- **Implementation approach:** B — full frontend-layer rebuild (new
  architecture + component library + design system); backend keeps its
  architecture and receives targeted business changes only.
- **Visual direction:** a brand-new design system, style = glassmorphism +
  stage feel.
- **Schema:** free to reshape (never deployed); no migrations to preserve.

## Phase Roadmap (whole product)

| Phase | Sub-project | Summary |
|---|---|---|
| **P1 (this spec)** | Creator self-service | 4 business refactors + new glass design system + rebuilt `/creator` pages + end-to-end run-through (incl. working creator sign-in) |
| P2 | Audience experience | Trigger runtime refactor + `/c/[slug]` rebuilt on the design system + production-grade |
| P3 | Admin operations | Plans / orders / quotas / review rebuilt + run-through |

The design system is built in P1 and reused by P2/P3. P1 only takes sign-in as
far as "a creator can reliably log into the backstage"; full auth hardening is
deferred.

## Section 1 — Frontend Architecture (Approach B)

**Rendering & data**
- React Server Components handle reads: dashboard, project lists, quota, and the
  project workspace render server-side (fast first paint, minimal client JS).
- Server Actions handle writes, replacing the current "form POST to `/api/*`
  route handler" pattern (`api-form.tsx`). Actions call the existing
  `src/lib/*` services internally — **service logic is reused; only the
  transport layer changes.**
- Client Components are interactive islands only: Live2D preview, model uploader
  with progress, tag editor, toasts.

**Forms & validation**
- React 19 `useActionState` + Server Actions + the existing **Zod** schemas:
  instant client feedback plus authoritative server validation.

**State management**
- Minimal. Server state via RSC/Actions; a lightweight client store
  (Zustand or context) only for ephemeral UI (drafts, toasts, active tab);
  filters/active step in URL state.

**Component library (new)**
- Bespoke glassmorphism primitives built on Radix primitives (for accessibility:
  focus, keyboard, ARIA), styled with new tokens: `StageBackdrop`,
  `GlassPanel/GlassCard`, `Button`, `Field/Input/Select/Switch`, `Tabs`,
  `Dialog/Sheet`, `Toast`, `Badge/Pill`, `ProgressBar`, `Stepper`, `DataTable`,
  `EmptyState`, `Live2DStage`.

**Backend (targeted changes only)**
- Keep `src/lib/*` services + Prisma. Make targeted changes for the four
  business areas and reshape the schema where needed. API moves from route
  handlers toward Server Actions calling the same services — services stay,
  entry points change.

**Next.js 16 note:** the repo's `AGENTS.md` warns this Next.js has breaking
changes; the implementation must consult `node_modules/next/dist/docs/` for
the current Server Actions / RSC conventions before writing code.

## Section 2 — Business-Flow Refactors

Schema may be reshaped directly (never deployed). DB is reset + re-seeded.

### ① Self-serve onboarding / plan gating
- **Problem:** a creator cannot create a project / upload a model / generate
  codes until an admin opens a `CreatorPlan` (all quotas hang off the plan).
- **Refactor:** new creators get a **default "trial" plan automatically on
  first sign-in** (idempotent `ensureCreatorPlan`), so they can self-serve
  immediately. Paid / admin-opened plans override or extend the trial. The
  manual-payment + `ManualOrder` model is fully preserved; it just stops being a
  prerequisite for using the product.
- Trial limits are **PlatformSetting-configurable** (infrastructure exists).
  Defaults: 1 project / 256 MB / 300 AI messages / 30 fan codes / 30 days.
- **Schema:** `CreatorPlan.tier` (`trial | paid`, default `trial`).

### ② Tag ↔ Voice ↔ Expression binding (core fix)
- **Problem:** binding is fragmented across three mechanisms that disagree:
  `VoiceAsset.tags` (string array) vs `TriggerTag.voiceAssets` (the M2M relation
  the runtime actually reads) — and uploads only set the former; expressions are
  driven by **hardcoded, tag-name-keyed parameters in the viewer** that do not
  match real models.
- **Refactor — TriggerTag is the single binding unit:**
  - The **M2M relation is the only source of truth**. The tag editor binds
    voices to tags via the relation. `VoiceAsset.tags` (string binding path) is
    **removed**.
  - Expressions bind to the model's **real capabilities**: on successful upload,
    parse `model3.json` to extract the model's actual Expressions and Motion
    groups. When configuring a tag, the creator picks from the real list
    (e.g. Izumi's Blushing / Smile / Sad); stored as `live2dParams`
    (`[{id,value}]`) plus an optional display name.
  - The viewer's hardcoded `expressionParams` is **removed**; the runtime only
    applies server-provided params, so any model works.
  - A tag = `{ keywords[], promptFragment, priority, enabled, expression
    (from model), params[], voices[] (relation) }`. Chat-keyword triggers and
    tap triggers read this one definition uniformly.
- **Schema:** `ModelAsset.capabilities` (Json cache of parsed
  expressions/motions/parameters); `TriggerTag.expressionName` (optional,
  display). Drop `VoiceAsset.tags` as a binding mechanism.

### ③ Model upload & validation UX
- **Problem:** the service validates/extracts/stores/sets-current, but the
  frontend lacks preview, readable validation feedback, and version/rollback or
  admin-assist UI.
- **Refactor:** upload with progress → **preview the model in the Live2D stage**
  before set-current / publish → **per-item validation feedback** (missing
  files, wrong version, etc.) → **version list + one-click rollback**
  (`rollbackModelAsset` exists) → **admin-assist** entry
  (`model-assistance-requests` exists). Successful upload triggers capability
  parsing (②).

### ④ Fan-code generation & distribution
- **Problem:** `generateFanCodeBatch` generates, hashes, and shows once, but
  distribution/management UX is thin.
- **Refactor:** batch form (quantity / expiry / per-code message limit / device
  binding) → one-time reveal + **CSV export + copy + per-code share link & QR**
  → **batch management** (list, revoke batch/code, reset device binding —
  services exist) → fan-code quota balance shown.

## Section 3 — Design System (Glassmorphism + Stage)

**Metaphor:** the page is a **stage** — atmospheric light at the back, the
Live2D character is the "performer," all controls are floating **glass** panels.
Configuring = "backstage"; publishing = "the show begins."

**Design tokens** (CSS custom properties in `tokens.css`)
- **Stage base:** deep indigo→near-black radial gradient
  `oklch(16% .03 265)` → `oklch(9% .02 270)`, plus an ambient glow layer.
- **Glass surfaces:** `background: oklch(100% 0 0 / .06)` +
  `backdrop-filter: blur(18px) saturate(140%)` +
  `border: 1px solid oklch(100% 0 0 / .12)` + top inner highlight.
  **Fallback** to an opaque dark surface when `backdrop-filter` is unsupported.
- **Accent:** aqua `oklch(80% .13 185)` primary, neon violet
  `oklch(70% .16 300)` secondary; semantic colors for success / in-progress /
  danger.
- **Typography (≤2 families):** a characterful grotesque display
  (e.g. Space Grotesk / Clash Display) + Inter body; clear scale contrast.
- **Radius/rhythm:** 16–20px on glass cards; spacing via a `--space-*` scale,
  avoiding uniform padding everywhere.
- **Motion:** `--ease-out-expo`, 200–300ms, animating only
  `transform/opacity/filter`; honor `prefers-reduced-motion`.

**Components:** `StageBackdrop`, `GlassPanel/GlassCard`, `Button`
(primary/secondary/danger/ghost), `Field/Input/Select/Switch`, `Tabs`,
`Dialog/Sheet`, `Toast`, `Badge/Pill`, `ProgressBar`, `Stepper`, `DataTable`,
`EmptyState`, `Live2DStage`.

**Readability & accessibility (critical):** glass over a Live2D scene can hurt
legibility — panels get a translucent **scrim** to keep WCAG AA contrast;
visible focus rings; keyboard reachable (Radix); hover/focus/active/empty/error
states are all designed (not library defaults).

**App shell:** glass left-nav + glass top-bar floating over `StageBackdrop`.

## Section 4 — Page Architecture

**Information architecture**
1. `/sign-in` — magic-link sign-in (Mailpit locally), glass-styled, minimal.
2. `/creator` — **dashboard**: plan/quota summary (trial banner + upgrade entry
   if trial), project cards (each shows **readiness**), create-project entry,
   recent usage. First visit = self-serve onboarding stepper.
3. `/creator/projects/[id]` — **project workspace** (the four modules live here).

**Project workspace layout — guided step rail + persistent stage preview**

```
┌──────────────────────────────────────────────────────┐
│  Steps: Basics✓ → Model✓ → Tags → Voice → Codes  [Publish]│
├───────────────────────────┬──────────────────────────┤
│  Live2DStage (persistent) │  Glass editor panel for   │
│  — the "performer",        │  the active step          │
│  live preview of           │  (content swaps per step) │
│  expression/voice bindings │                          │
└───────────────────────────┴──────────────────────────┘
```
- **Persistent left Live2D stage** across all steps: live preview when
  configuring tags/voices, reinforcing the stage metaphor and directly serving
  "run-through" (configure and see it at once).
- **Top step rail** derives completion from `project-readiness` (lib exists,
  extended). Any step is jumpable; not forced-linear.
- **Publish** is gated by readiness: cannot publish until the model is valid.

**Five modules (right panel)**
- **Basics:** name / slug / intro / systemPrompt / welcome / theme /
  avatar / background + publish toggle + share link & QR.
- **Model:** drag-drop upload (progress) → live preview in the stage →
  per-item validation → set current / version list / one-click rollback /
  admin-assist. Successful upload parses model capabilities (for Tags).
- **Tags:** unified tag editor — each tag `{ keywords, promptFragment,
  priority, enabled, expression (from model capabilities), params, bound
  voices }`; built-in **live test** (hit → stage shows expression + voice).
- **Voice:** upload WAV/MP3, name, **bind to tags (relation)**, preview /
  replace / delete, voice-clone request.
- **Codes:** batch generate (quantity / expiry / per-code limit / device
  binding) → one-time reveal + CSV export + per-code share link & QR → batch
  management (revoke / reset binding) → quota balance.

**Readiness-driven progression:** a project's derived readiness (has model? has
≥1 tag? has voice? has codes? published?) drives the step rail, dashboard card
state, and the publish gate — making "configure a usable character and publish"
visible and runnable.

## Section 5 — Data Flow / Errors / Testing & Acceptance

**Data flow**
- **Reads:** RSC fetch via `src/lib/*` / Prisma in server components (dashboard
  and workspace load project + readiness + capabilities + tags + voices + codes
  in one pass).
- **Writes:** Server Actions wrapping existing services, returning typed
  results; client uses `useActionState` for pending/error; `revalidatePath`
  after mutations.
- **Large uploads:** the model zip (up to 100 MB) uses **client presigned PUT
  direct to MinIO (with progress)**, then a finalize Server Action fetches it
  from storage to validate + extract (`getObjectBytes` exists) — avoiding piping
  100 MB through the action. Voice files are small → FormData action.
- **Live preview:** the left `Live2DStage` loads the model through the existing
  `/api/assets/live2d-model` proxy (creator is authenticated → `asset-access`
  authorizes via the authenticated path). Tag testing is **client-only** —
  it directly applies the tag's expression/params/voice, **no LLM needed**.

**Errors & empty states (every module)**
- Empty states (no model / no tags / no voices / no codes) with clear CTAs;
  skeletons while loading.
- Validation errors shown **inline** (model validation list, Zod field errors).
- Quota-exhausted (storage / AI / fan-code) states with an upgrade entry;
  trial-expiry handling.
- Any action failure → toast + retry; **never silently swallow errors**.

**Testing & "run-through" acceptance**
- **Unit:** keep the existing 172 tests; add tests for new/changed services
  (`ensureCreatorPlan`, tag↔voice binding, model-capability parsing, readiness).
- **E2E (the "run-through" hard gate; existing browser-qa / Playwright):** one
  full creator journey must pass green:
  1. Sign in (Mailpit) → dashboard with an auto trial plan.
  2. Create a project.
  3. Upload a Live2D model (Izumi/Belfast fixtures) → preview → validation valid.
  4. Configure ≥1 tag (expression from the model) + bind a voice.
  5. Upload a voice, bind to a tag.
  6. Generate a fan-code batch, export/reveal codes.
  7. Publish.
  8. Cross-check: open `/c/[slug]` with a generated code → model renders, a
     chat keyword triggers the tag's voice + expression, a tap triggers
     motion + voice.
- **"Run-through" = that journey green in Playwright + no dead links/placeholders
  in the creator UI.** This is Phase 1's acceptance criterion.
- Visual regression of key creator screens at 320/768/1024/1440; keyboard
  reachability, glass contrast, and reduced-motion accessibility checks.

## Environment & Mocking Strategy

The acceptance bar is "all flows run end-to-end"; where a real external
environment is required, it is **mocked / stood up locally** rather than wired
to a production provider:

- **Database:** local Postgres via the integration docker compose.
- **Object storage:** local MinIO (real S3 API; presigned PUT works locally —
  bucket CORS configured for the browser upload).
- **Email (magic link):** Mailpit (SMTP 1025, inbox UI 8025) — the sign-in flow
  reads the link from Mailpit.
- **LLM:** the keyword-fallback path (no key) or the integration `fake-openai`
  server. Tag *testing* in the editor needs no LLM at all (client-side apply).
- **Payment:** manual (no gateway); admin/manual-order path stands in.
- **Voice/TTS:** preset uploads (and the existing local TTS fixtures); automated
  cloning is request-only.

E2E tests run against this fully-local stack. No flow may dead-end on a missing
real provider — if a provider is absent, it is mocked so the journey completes.

## Out of Scope (Phase 1)

- Audience-page rebuild (P2) and admin-operations rebuild (P3).
- Real payment gateway, deployment, full auth hardening.
- Automated voice cloning (request entry only).

## Risks / Open Questions

- Presigned direct-to-MinIO upload requires CORS config on the bucket; confirm
  during implementation.
- Model-capability parsing must handle models with empty/odd `model3.json`
  (e.g. Azur Lane single unnamed motion group) — covered by fixture tests.
- Glass legibility over busy art needs per-panel scrim tuning; validate via
  visual regression.
