# Feature Status

Legend: ✅ implemented · 🟡 partial / stubbed · ⛔ not implemented · ❌ removed

This reflects what is actually wired in the codebase (not aspirational). See
[`PRD.md`](PRD.md) for the requirements behind each area.

---

## 1. Landing & interactive demo (`/`)

| Feature | Status | Notes |
| --- | --- | --- |
| Live2D demo stage (4 sample characters) | ✅ | Self‑hosted PixiJS runtime; model loads in‑page |
| Character switch (cycle / top‑left) | ✅ | Hot‑swaps the model |
| Motions / Expressions panels | ✅ | Icon dock, hover‑revealed |
| Audio panel (voice volume, random line, BGM) | ✅ | Self‑hosted ambient BGM |
| Scenes (token‑gradient backgrounds) | ✅ | No external imagery |
| Tap / touch interaction on the model | ✅ | Manual `hitTest` (head/body/special → voice + motion) |
| Gaze follow (mouse / touch) | ✅ | |
| Desktop‑pet mode (floating, draggable) | ✅ | Side icon controls, hover‑reveal, "chat" line button |
| Pet shown only on non‑model pages | ✅ | Hidden on audience/creator/admin model‑view pages |
| Pet mode not auto‑restored on homepage reload | ✅ | Persisted only for non‑home pages |

## 2. Auth & accounts

| Feature | Status | Notes |
| --- | --- | --- |
| Username + password sign‑in | ✅ | Server‑side sessions (hashed token cookie) |
| Dev login shortcuts (admin / creator) | ✅ | Non‑production only |
| Password change | ✅ | Rate‑limited; invalidates other sessions |
| Roles: super_admin / ops_admin / support_admin / creator | ✅ | Permission sets in `lib/permissions.ts` |
| Magic‑link / email login | ❌ | Removed (deferred); only the field label remains |
| Self‑serve account signup | ⛔ | Accounts are provisioned by an admin (MVP) |

## 3. Creator workbench (`/creator`) — single model

| Feature | Status | Notes |
| --- | --- | --- |
| Create project (name, slug, intro, avatar, bg, theme) | ✅ | One project per plan slot (default 1) |
| **System prompt** (private, drives AI) | ✅ | Not shown to audiences |
| **Character setting** (public, shown to audiences) | ✅ | Separate field from system prompt |
| Welcome message | ✅ | First assistant message |
| Upload Live2D `.zip` (validate + extract) | ✅ | Zip‑bomb / size guards; allowlisted asset types |
| Model management UI (model‑first, upload on demand) | ✅ | Styled file picker; panel hidden until "upload" |
| Trigger tags (keywords → expression / params / voice) | ✅ | Priority, enable toggle |
| Tag tester (preview matching) | ✅ | Uses the same AI proxy path |
| Publish / pause (readiness‑gated) | ✅ | 4 gates: profile, valid model, ≥1 tag, ≥1 real fan code |
| Fan‑code batch generation | ✅ | Quantity ≤500, expiry ≤2y, per‑code msg cap, device bind |
| Plan/quota display + billing pages | ✅ | |
| Model‑assistance request (admin help) | ✅ | |
| Creator self‑upload of voice lines | 🟡 | Voice assets are **admin‑assisted**; no creator upload UI |
| Multiple models per creator | 🟡 | Quota (`maxProjects`) supports it; UI is single‑model‑first |

## 4. Audience experience (`/c/[slug]`)

| Feature | Status | Notes |
| --- | --- | --- |
| Fan‑code entry gate | ✅ | Device binding, expiry, status, quota checks |
| Public character setting on the gate | ✅ | |
| Real‑time streaming AI chat | ✅ | Server‑proxied; reply buffered + moderated before display |
| Tag‑driven Live2D effects | ✅ | Params + expression + matched voice line |
| Remaining‑quota display + error states | ✅ | bound‑device / expired / quota / unpublished |
| Live model render (creator's uploaded model) | ✅ | Self‑hosted runtime, gaze + tap reactions |
| Abort / timeout on the chat stream | ✅ | |
| Lip‑sync to voice | 🟡 | UI toggle only; no audio‑driven lip sync |
| TTS / generated voice | ⛔ | Only preset voice lines play |

## 5. Admin console (`/admin`)

| Feature | Status | Notes |
| --- | --- | --- |
| Platform settings (AI / moderation / asset delivery) | ✅ | i18n; values shown literally |
| **AI provider config** (25 China + intl presets) | ✅ | Pick provider → base URL auto‑fills; paste key; model dropdown |
| Content moderation mode (off/basic/strict) | ✅ | Applied to chat input + output |
| Asset delivery mode (app‑proxy / signed‑redirect) | ✅ | |
| User / creator management | ✅ | |
| Project review (pause / publish), model preview | ✅ | |
| Inline edit of system prompt + character setting | ✅ | Any project, audited |
| Model upload on a creator's behalf | ✅ | |
| Fan‑code generation (admin) | ✅ | |
| Manual order confirmation | ✅ | |
| Quota grants + ledger | ✅ | |
| Support notes | ✅ | |
| Diagnostics / billing pages | ✅ | |

## 6. Backend & platform

| Feature | Status | Notes |
| --- | --- | --- |
| AI proxy (OpenAI‑compatible, key server‑only) | ✅ | 25 provider presets; local keyword fallback when disabled |
| Chat quota: reserve → record → refund (atomic) | ✅ | Reserved before the paid AI call |
| Creator monthly AI limit (atomic) | ✅ | |
| Device binding re‑checked every message | ✅ | |
| Rate limiting | ✅ | chat (IP + session), sign‑in, uploads, fan‑code/project/tag/checkout |
| Content safety (input) + output moderation | ✅ | |
| Zip‑bomb / upload size guards | ✅ | declared + running decompressed caps |
| Input bounds (string/array/number caps) | ✅ | project, tag, fan‑code, admin inputs |
| CSP per‑request **nonce** (no `unsafe-inline` scripts) | ✅ | via `src/proxy.ts` |
| Security headers (HSTS, X‑Frame, etc.) | ✅ | |
| Audit log on privileged actions | ✅ | |
| Payment webhook: signature verify + idempotency | ✅ | `ProcessedWebhookEvent` dedup |
| i18n (zh / en / ja) | ✅ | |
| Fan codes stored in plaintext (by design) | ✅ | Intentional: creators re‑display codes |

## 7. Billing & payments

| Feature | Status | Notes |
| --- | --- | --- |
| `manual-only` checkout (admin confirms orders) | ✅ | The working path |
| Plans, quota grants, ledger, order history | ✅ | |
| `provider-sandbox` / `provider-live` checkout | 🟡 | Settings + labels + webhook exist; **no real payment‑provider integration** |

## 8. Infrastructure / data

| Feature | Status | Notes |
| --- | --- | --- |
| Local DB = PGlite (file, no server/Docker) | ✅ | `PGLITE_DATA_DIR` |
| Prod DB = PostgreSQL (same schema) | ✅ | unset `PGLITE_DATA_DIR` + `DATABASE_URL` |
| Object storage: local filesystem in dev, S3 in prod | ✅ | `STORAGE_DRIVER=local` → `.local-storage/`; no MinIO/Docker needed |
| Showroom seed (4 demo models as published projects) | ✅ | `npm run setup:showroom` → `showroom` creator |
| Entry-test character = 爱宕 Atago (outfit/motions/expressions/voice) | ✅ | `npm run setup:entry`; authored `.exp3.json` expressions on the Atago model |
| Prisma 7 driver adapters | ✅ | |
| Prisma migration history | ❌ | Removed; schema applied via `db push` |
| `storageLimitMb` enforcement | ⛔ | Field exists (default 0); not enforced |
| Voice clone | ❌ | Removed |
| Skins per character | ❌ | Removed (was dead UI) |

---

## Known gaps / next up

- **Real payment‑provider integration** (provider‑sandbox/live) — only manual orders work today.
- **Creator self‑serve voice upload** — currently admin‑assisted.
- **Audio‑driven lip‑sync** — toggle only.
- **Multi‑model creator UI** — backend quota allows it; the workbench is single‑model.
- **Production deploy story** — local‑only right now (PGlite, no migrations).
