# Live2D Creator Platform — Product Requirements (PRD)

Status: living document · Scope: current MVP (single‑model‑first) · See
[`FEATURES.md`](FEATURES.md) for build status of each item.

---

## 1. Summary & vision

A platform that lets a creator turn one Live2D model into an **AI‑driven, code‑gated
companion** that fans can chat with in real time. The creator configures who the character
is (persona), how it reacts (trigger tags → expression / parameters / voice), and who can
access it (fan codes with device binding and message quotas). The platform proxies all AI
calls (keys never reach the browser), enforces quotas and content safety, and gives admins
the controls to run it (AI provider, moderation, plans, billing, model assistance).

**One‑line value:** *upload a model, give it a persona and trigger tags, hand out access
codes — fans chat with a living character; you never expose a key and never overspend.*

## 2. Personas

| Persona | Goal | Surface |
| --- | --- | --- |
| **Creator** (streamer / VTuber) | Publish a character fans can talk to; control persona, reactions, access, cost | `/creator` |
| **Audience** (fan) | Enter with a code and chat with the character in real time | `/c/[slug]` |
| **Admin** (platform ops) | Configure AI provider, moderation, plans/billing; review & assist projects | `/admin` |
| **Visitor** | See what the product does | `/` (landing demo) |

## 3. Surfaces & requirements

### 3.1 Landing / demo (`/`)
- R1. Show an interactive Live2D character (no login) that demonstrates motions,
  expressions, voice, scene switching, and touch reactions.
- R2. Offer a "desktop‑pet" mode (a floating, draggable character) as a feature preview.
- R3. Must not require a CDN — the Live2D runtime and sample assets are self‑hosted.
- R4. Entering the site must **not** auto‑open the pet from a previous session.

### 3.2 Creator workbench (`/creator`)
Single‑model‑first: each creator manages **one** project/model (plan‑quota may raise this).

- R5. **Profile**: name, public slug, intro, avatar, background, theme color.
- R6. **AI persona — two distinct fields:**
  - *System prompt* (private): the instruction that drives the AI. Never shown to fans.
  - *Character setting* (public): a persona description **shown to the audience** on the gate.
- R7. **Welcome message**: first message the character "says".
- R8. **Model**: upload a Live2D `.zip` (exactly one `model3.json`, allowlisted asset types).
  The workbench defaults to *showing the model*, revealing the upload panel only on demand.
- R9. **Trigger tags**: keyword sets that, when matched in a fan's message, fire a Live2D
  expression / parameter change / voice line. Tags have priority and an enable toggle, and a
  **tester** that previews matching using the same backend path as live chat.
- R10. **Fan codes**: generate a batch (quantity, expiry, per‑code message cap, device‑bind
  mode). Codes are listed for distribution.
- R11. **Publish/pause**: a project can be published only when *all* readiness gates pass —
  profile complete, a **valid** model uploaded, ≥1 enabled trigger tag, ≥1 real (non‑preview)
  fan code — and the creator's plan is active.
- R12. **Billing**: see plan/quota usage; request a plan/quota purchase (manual checkout).
- R13. **Persistent preview**: a live preview of the character + a test chat alongside the
  editor.

### 3.3 Audience (`/c/[slug]`)
- R14. **Gate**: a fan enters a code. The platform checks status, expiry, per‑code quota, the
  project being published, the creator active, and (if device‑bound) binds/verifies the
  browser device. The public **character setting** is shown here.
- R15. **Chat**: real‑time, streamed AI replies. The reply is **moderated before** it is shown
  (no unsafe tokens leak mid‑stream). Quota remaining is displayed.
- R16. **Reactions**: matched trigger tags drive the live model's expression, parameters, and
  a voice line.
- R17. **Resilience**: clear states for bound‑to‑another‑device, expired/revoked code, quota
  exhausted, project unpublished; chat stream can abort/timeout.

### 3.4 Admin console (`/admin`)
- R18. **AI provider config**: pick from built‑in OpenAI‑compatible presets (China +
  international); base URL auto‑fills, admin pastes the API key, picks/typing a model. Key is
  stored server‑side only and never returned to the client.
- R19. **Platform policy**: content‑moderation mode (off/basic/strict), max fan message
  length, protected‑asset delivery mode.
- R20. **People**: manage users and creators (status, plans).
- R21. **Projects**: review, pause/publish, preview the model, upload a model on a creator's
  behalf, and inline‑edit a project's system prompt + character setting (audited).
- R22. **Fan codes**: generate codes for any project.
- R23. **Billing**: confirm manual orders, grant quota (ledgered), view orders, add support
  notes.
- R24. **Diagnostics**: platform health view.

## 4. Core flows

### 4.1 Fan‑code lifecycle
1. Creator (or admin) generates a batch → consumes `fanCodeQuota` (atomic). Codes get a hash
   (unique lookup), an expiry, a per‑code `maxMessages`, and a bind mode.
2. A fan redeems a code → a **viewer session** is created; if device‑bound, the first device
   is claimed atomically (first‑come‑wins).
3. Each chat message re‑verifies device binding, status, expiry, and quota.
4. A message **reserves** quota (per‑code + creator monthly) *before* the AI call; on AI
   failure the reservation is **refunded**; on success it's **recorded** (usage + ledger).

### 4.2 AI request path
1. Client → `/api/chat` (rate‑limited by IP **and** session).
2. Server validates the session, device, status, and quota; safety‑filters input and any
   client‑supplied history.
3. Server reserves quota, then calls the configured **OpenAI‑compatible** provider
   server‑side (key never exposed). With AI disabled, a local keyword fallback is used.
4. The full reply is buffered, **moderated**, then streamed/sent; matched tags become Live2D
   effects; usage is recorded.

### 4.3 Publishing
A project is publishable only when all readiness gates pass (R11) and the plan is active;
gates are re‑checked server‑side at publish — they cannot be bypassed via the API.

## 5. Data model (essentials)

`User` (role, status) · `CreatorPlan` (tier, status, expiry, `maxProjects`,
`monthlyAiMessageLimit`, `fanCodeQuota`, usage) · `Project` (name, slug, **systemPrompt**,
**characterSetting**, welcomeMessage, theme, status, current model) · `ModelAsset` /
`VoiceAsset` · `TriggerTag` (keywords, promptFragment, expression, params, priority) ·
`FanAccessCode` (codeHash, code, expiresAt, maxMessages, usedMessages, bindMode,
boundDeviceHash, status, batchId) · `ViewerSession` · `ChatUsage` / `QuotaLedgerEntry` ·
`Order` / payments · `PlatformSetting` · `AuditLog`.

## 6. Constraints & limits (enforced server‑side)

| Limit | Value |
| --- | --- |
| Projects per creator | `plan.maxProjects` (trial default 1) |
| Fan‑code batch size | 1–500 |
| Fan‑code expiry | future, ≤ 2 years |
| Per‑code message cap | 1–100,000 |
| Chat message length | ≤ `maxFanMessageLength` (default 1200; hard zod cap 10,000) |
| Chat history sent | ≤ 20 messages, each ≤ 4000 chars, safety‑filtered |
| Model upload | ≤ 100 MB compressed; decompressed caps (per‑file 150 MB, total 300 MB) |
| Project text fields | name ≤200, intro ≤2000, system/character ≤8000, welcome ≤2000 |
| Tag fields | name ≤100, desc ≤500, fragment ≤2000, keywords ≤50×≤50 chars |
| Rate limits | chat 20/min (IP+session), sign‑in 5/min, uploads/fan‑codes/project/tag/checkout 10–30/min |

## 7. Security requirements

- AI provider key is **server‑only** — never in `NEXT_PUBLIC_*`, never serialized to the
  client; the proxy is the only client‑reachable path.
- All Live2D runtime + model assets are **self‑hosted** (no third‑party CDN at runtime).
- Per‑request CSP **nonce** (no `'unsafe-inline'` in `script-src`); HSTS, `X-Frame-Options:
  DENY`, etc.
- AuthZ is server‑side on every route/mutation (UI hiding is not a control).
- Chat input safety + output moderation; zip‑bomb / upload‑size guards; broad input bounds.
- Payment webhooks: HMAC signature verified (timing‑safe) + per‑event idempotency.
- Audit log on privileged/admin actions.
- **Fan codes are stored in plaintext by design** (creators must re‑display & redistribute
  codes); the `codeHash` column remains for unique lookup/validation.

## 8. Non‑goals (current MVP)

- A real payment‑provider integration (only manual orders are live).
- Creator self‑serve voice upload (admin‑assisted today).
- Audio‑driven lip‑sync, TTS / generated voice.
- Multi‑model creator UI (the schema/quota allow it; the workbench is single‑model).
- A production deployment pipeline with migrations (local‑first; PGlite + `db push`).

## 9. Glossary

- **Trigger tag** — a creator‑defined keyword set that maps a matched message to a Live2D
  effect (expression / parameter / voice).
- **Fan access code** — a redeemable, optionally device‑bound, quota‑limited entry token for
  the audience chat.
- **System prompt** vs **character setting** — private AI instruction vs the public persona
  shown to fans.
- **Asset delivery mode** — how protected model files reach the browser: streamed by the app
  (`app-proxy`) or via a time‑limited signed URL (`signed-redirect`).
