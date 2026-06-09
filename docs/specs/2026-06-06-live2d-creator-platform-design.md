# Live2D Creator Platform Design

Date: 2026-06-06

## Summary

Build a SaaS platform for streamers to create and share a Live2D AI companion with their audience. The MVP focuses on the streamer self-service configuration workflow: upload or request admin setup for a Live2D model, manage preset voice assets, create unified trigger tags, generate fan access codes, and share a protected audience chat page.

The platform will use manual payment handling in the first version. Platform admins record paid plans, expiration dates, quotas, and fan-code packages in the admin dashboard. Automated payment, self-service voice cloning, public marketplace discovery, and deep platform identity checks are intentionally out of scope for the MVP.

## Goals

- Let streamers create a branded Live2D AI companion project.
- Let streamers upload Live2D model zip files, while preserving an admin-assisted setup path.
- Let streamers upload preset voice clips and bind them to tags.
- Let streamers define trigger tags that control Live2D expressions, parameters, audio, and prompt fragments.
- Let streamers generate fan access codes with expiration, per-code message limits, and device binding.
- Let fans open a share link, enter an access code, and freely chat with the streamer’s AI companion.
- Let platform admins manage streamer accounts, paid plans, quotas, manual orders, project status, clone requests, and audit logs.

## Non-Goals

- No automatic payment integration in MVP.
- No self-service voice cloning in MVP.
- No public streamer marketplace.
- No automatic revenue sharing or fan payment flow.
- No Douyin/WeChat fan identity verification in MVP.
- No complex analytics dashboard in MVP beyond quota and recent usage.
- No direct exposure of LLM, TTS, storage, or internal service API keys to browser clients.

## User Roles

### Super Admin

Highest platform permission. Usually limited to the platform owner and trusted core operators.

Can:

- Create, disable, and manage platform admin users.
- View all streamers, projects, assets, fan codes, manual orders, and usage.
- Create and confirm manual orders.
- Open, extend, pause, or modify streamer plans and quotas.
- Grant fan-code quota or message quota.
- Configure platform-level AI, TTS, storage, and security settings.
- Suspend streamers or projects.
- View audit logs.

### Ops Admin

Operational staff for customer success and manual project delivery.

Can:

- Create streamer accounts.
- Open or update streamer plans within allowed policy.
- Help upload or fix Live2D models.
- Help upload voice assets.
- Review voice-clone requests.
- Generate or grant fan-code packages.
- Pause or restore projects.
- View usage and asset status.

Cannot:

- Create admin users.
- Modify platform provider secrets.
- Delete critical data.
- Edit audit logs.

### Support Admin

Limited support role for troubleshooting.

Can:

- View streamer/project/fan-code status.
- Diagnose expired codes, device binding issues, and quota exhaustion.
- Add support notes.

Cannot:

- Change paid plans.
- Confirm payments.
- Grant quota.
- Modify project assets.

### Creator / Streamer

Creates and manages Live2D companion projects.

Can:

- Log in with email magic link or code.
- Create and edit projects.
- Upload Live2D model zip files.
- Request admin help for model setup.
- Upload WAV/MP3 voice assets.
- Create trigger tags.
- Generate fan access codes within quota.
- View plan, quota, and recent usage.
- Copy share links.
- Submit voice-clone requests.

### Fan / Viewer

Accesses a streamer’s shared companion page.

Can:

- Open a project share link.
- Enter a fan access code.
- Bind the code to the current browser/device if required.
- Chat freely with the AI companion while quota and access remain valid.

## MVP Product Scope

### Included

- Creator account with email login.
- WeChat login provider reserved for later implementation.
- Admin roles: Super Admin, Ops Admin, Support Admin.
- Manual order and paid plan management.
- Creator plan quotas: projects, storage, AI messages, fan-code quota, expiration.
- Creator project CRUD.
- Live2D zip upload and validation.
- Admin-assisted model configuration.
- Preset voice upload and tag binding.
- Voice-clone request entry, without automatic cloning.
- Unified trigger tags.
- Fan access-code generation, expiration, quota, and device binding.
- Audience Live2D chat page.
- LLM backend proxy with structured tag output.
- Quota deduction and basic usage logging.
- Audit logs for payment, quota, project, and admin actions.

### Excluded

- Automated checkout.
- Automated voice cloning.
- Self-service package purchasing.
- Deep analytics.
- Marketplace discovery.
- Fan account system.
- Advanced content moderation dashboard.

## Core User Flows

### Admin Opens a Creator Plan

1. Admin creates or selects a creator account.
2. Admin creates a manual order.
3. Admin records amount, payment method, plan name, plan period, quotas, and notes.
4. Admin confirms payment.
5. System writes or updates the creator’s plan and quota ledger.
6. Creator dashboard displays active plan, expiration, and quota.

Manual payment is the source of commercial truth. Quota changes are the operational result. They must be linked but stored separately for auditability.

### Creator Creates a Project

1. Creator creates a project with name, slug, avatar, intro, welcome message, theme, and system prompt.
2. Creator uploads a Live2D zip or marks the project for admin-assisted setup.
3. System extracts and validates the model.
4. If valid, system stores the model resource metadata and makes the model preview available.
5. Creator edits prompt, tags, voices, and fan-code settings.
6. Creator publishes the project.

### Creator Manages Voice Assets

1. Creator uploads WAV/MP3 files.
2. Creator gives each audio file a name.
3. Creator binds audio files to tags.
4. Creator can preview, replace, or delete voice assets.
5. Creator can submit a voice-clone request with authorization confirmation and notes.

Voice-clone requests are tracked but not automatically fulfilled in MVP.

### Creator Configures Trigger Tags

Each trigger tag can bind one or more of:

- Live2D expression file.
- Live2D parameter changes.
- Preset voice assets.
- Prompt fragment.
- Keywords or semantic description.
- Priority.
- Enabled/disabled state.

Tags are the shared control layer between AI output, Live2D rendering, and voice playback.

### Creator Generates Fan Codes

1. Creator selects a published project.
2. Creator chooses quantity, expiration, message limit per code, and device-binding mode.
3. System checks creator fan-code quota.
4. System generates codes and stores only code hashes.
5. Codes are shown once and can be exported as CSV.
6. Creator distributes codes to fans.

### Fan Accesses Shared Companion

1. Fan opens `/c/:projectSlug`.
2. Fan enters access code.
3. Backend validates project status, code hash, expiration, quota, and device binding.
4. If first use and binding is enabled, code binds to browser/device hash.
5. Fan enters the Live2D chat page.
6. Fan sends free-form messages.
7. Backend builds the prompt, calls the LLM, returns reply and tags.
8. Frontend renders the reply and triggers Live2D expression/audio/parameter effects.
9. Backend deducts fan-code and creator-plan message quota after successful AI response.

## Page and Feature Inventory

### Creator Dashboard

- Current plan name.
- Plan expiration.
- AI message usage.
- Fan-code quota.
- Storage usage.
- Project list with status.
- Create project entry.
- Copy share link.

### Project Settings

- Project name.
- Slug.
- Avatar.
- Intro.
- Theme color.
- System prompt.
- Default welcome message.
- Publish/pause status.

### Model Management

- Upload Live2D zip.
- Show validation status.
- Show validation errors.
- Preview model.
- Mark admin-assisted setup.
- Replace model.
- Keep recent successful version for rollback.

### Voice Management

- Upload WAV/MP3.
- Name voice assets.
- Bind tags.
- Preview voice.
- Delete voice.
- Submit voice-clone request.

### Trigger Tag Editor

- Add/edit/delete tags.
- Configure keywords and semantic description.
- Bind Live2D expression or parameter changes.
- Bind voice assets.
- Configure prompt fragment.
- Configure priority.
- Enable/disable tag.
- Test sample message and inspect triggered tags.

### Fan Access-Code Management

- Generate code batches.
- Set expiration.
- Set per-code message limit.
- Set device binding.
- Export CSV.
- View code status: unused, bound, used up, expired, revoked.
- Revoke batch or individual code.

### Admin Dashboard

- Admin login.
- Admin user management, restricted to Super Admin.
- Creator list.
- Creator status.
- Creator projects.
- Paid plan and quota panel.
- Manual order panel.
- Fan-code quota grants.
- Project pause/restore.
- Admin-assisted model/voice setup.
- Voice-clone request queue.
- Audit log.

### Audience Share Page

- Access-code entry.
- Clear error states.
- Live2D model.
- Chat input.
- AI response bubbles.
- Triggered expression and voice playback.
- Remaining message display.
- Expired/quota/binding status pages.

## System Architecture

Use a standard Web SaaS architecture rather than extending the static demo directly. The existing `pixi-live2d-display` demo can inform the audience page, but the platform requires backend services, persistence, role-based auth, object storage, and quota enforcement.

### Frontend

Recommended: Next.js.

Routes:

- Creator dashboard.
- Admin dashboard.
- Audience share page.
- API routes or server actions for authenticated operations.

Next.js is recommended because it keeps dashboard pages, public audience pages, backend APIs, and auth integration in one deployable application.

### Backend API

Responsibilities:

- Authentication and sessions.
- Role-based authorization.
- Manual order and plan management.
- Quota enforcement.
- Live2D zip upload, extraction, validation, and metadata storage.
- Voice upload and metadata storage.
- Fan-code generation, hashing, validation, binding, and deduction.
- LLM proxy with prompt construction and output validation.
- Signed asset URL generation or asset proxying.
- Audit logging.

### Database

Recommended: PostgreSQL with Prisma.

Stores:

- Users and roles.
- Creator profiles.
- Plans and quota ledgers.
- Manual orders.
- Projects.
- Model asset metadata.
- Voice asset metadata.
- Trigger tags.
- Fan access codes.
- Viewer sessions.
- Usage records.
- Voice-clone requests.
- Audit events.

### Object Storage

Recommended: Cloudflare R2, S3, or OSS.

Stores:

- Original Live2D zip files.
- Extracted Live2D resources.
- Audio files.
- Avatars and cover images.

Assets should not be permanently public. The backend should issue short-lived signed URLs or proxy access after validating the fan session.

### AI Service

Use an OpenAI-compatible backend proxy for MVP.

Backend sends:

- Project system prompt.
- Trigger tag definitions.
- Safety instructions.
- Recent chat context.
- User message.

Backend expects structured output:

```json
{
  "reply": "我会陪着你的，别硬撑。",
  "tags": ["脸红", "安慰"]
}
```

If structured parsing fails, backend should fallback to a safe plain reply with default or empty tags.

### Live2D Rendering

Audience page renders Live2D in the browser with PixiJS and `pixi-live2d-display`. The backend provides authorized model resource references. The browser handles rendering, expression switching, parameter changes, audio playback, and mouth motion visualization.

## Core Data Model

### User

- `id`
- `email`
- `wechatOpenId`
- `role`: `super_admin | ops_admin | support_admin | creator`
- `status`: `active | suspended`

### CreatorProfile

- `userId`
- `displayName`
- `avatarUrl`
- `bio`

### CreatorPlan

- `creatorId`
- `planName`
- `startsAt`
- `expiresAt`
- `maxProjects`
- `storageLimitMb`
- `monthlyAiMessageLimit`
- `fanCodeQuota`
- `usedAiMessages`
- `usedStorageMb`
- `status`

### ManualOrder

- `id`
- `creatorId`
- `orderType`: `plan | fan_code_pack | quota_adjustment`
- `amount`
- `currency`
- `paymentMethod`: `wechat | alipay | bank_transfer | other`
- `paymentStatus`: `pending | confirmed | refunded | void`
- `planName`
- `periodStart`
- `periodEnd`
- `projectQuotaDelta`
- `aiMessageQuotaDelta`
- `storageQuotaDeltaMb`
- `fanCodeQuotaDelta`
- `notes`
- `createdByAdminId`
- `confirmedByAdminId`
- `confirmedAt`

### QuotaLedgerEntry

- `creatorId`
- `manualOrderId`
- `entryType`: `grant | consume | adjustment | expiration_reset`
- `resource`: `ai_messages | fan_codes | storage_mb | projects`
- `amount`
- `reason`
- `createdByAdminId`
- `createdAt`

### Project

- `creatorId`
- `name`
- `slug`
- `avatarUrl`
- `intro`
- `systemPrompt`
- `welcomeMessage`
- `theme`
- `status`: `draft | published | paused`
- `modelAssetId`

### ModelAsset

- `projectId`
- `sourceZipUrl`
- `modelJsonPath`
- `assetBasePath`
- `validationStatus`: `pending | valid | invalid`
- `validationErrors`
- `uploadedBy`: `creator | admin`
- `version`

### VoiceAsset

- `projectId`
- `name`
- `audioUrl`
- `durationMs`
- `tags`
- `status`: `active | disabled`

### TriggerTag

- `projectId`
- `name`
- `description`
- `keywords`
- `promptFragment`
- `live2dExpression`
- `live2dParams`
- `voiceAssetIds`
- `priority`
- `enabled`

### FanAccessCode

- `projectId`
- `codeHash`
- `expiresAt`
- `maxMessages`
- `usedMessages`
- `bindMode`: `none | browserDevice`
- `boundDeviceHash`
- `status`: `active | revoked | expired`
- `batchId`

### ViewerSession

- `projectId`
- `fanAccessCodeId`
- `deviceHash`
- `createdAt`
- `lastSeenAt`

### ChatUsage

- `creatorId`
- `projectId`
- `fanAccessCodeId`
- `messageCount`
- `tokenEstimate`
- `createdAt`

### VoiceCloneRequest

- `creatorId`
- `projectId`
- `status`: `submitted | reviewing | approved | rejected | fulfilled`
- `authorizationConfirmed`
- `notes`

### AuditLog

- `actorUserId`
- `actorRole`
- `action`
- `targetType`
- `targetId`
- `before`
- `after`
- `ipAddress`
- `createdAt`

## Security and Quota Rules

### Asset Security

- Store Live2D and audio assets in object storage.
- Do not expose permanent public URLs for protected project assets.
- Use signed URLs or a backend asset proxy after validating a viewer session.
- Original uploaded zip files are visible only to the creator and admins.

### API Key Security

- Store LLM, TTS, storage, and provider secrets only in backend environment variables.
- Browser clients call platform-owned API routes only.

### Fan Code Security

- Store only hashed fan codes.
- Show generated codes once.
- Allow CSV export immediately after generation.
- Bind device when `bindMode=browserDevice`.
- Device binding uses a browser device ID in localStorage plus a coarse user-agent hash. It is not intended as strong anti-fraud identity.

### Quota Deduction

After a successful AI response:

- Increment `FanAccessCode.usedMessages`.
- Increment creator AI usage.
- Create `ChatUsage`.
- Optionally create `QuotaLedgerEntry` for aggregate tracking.

Do not deduct quota when AI call fails before a valid response.

### Plan Expiration

When a plan expires:

- Creator cannot publish new projects.
- Creator cannot generate new fan codes.
- Creator cannot upload new assets beyond emergency admin action.
- Existing audience access defaults to paused for new sessions.
- Admin can extend, restore, or manually override.

### Upload Validation

Live2D zip validation must reject:

- Missing `model3.json`.
- Referenced files missing from zip.
- Unsupported model version.
- Zip path traversal.
- Files over configured size limit.
- Disallowed file extensions.

### AI Output Handling

- Backend requests JSON output with `reply` and `tags`.
- Backend validates tags against enabled project tags.
- Unknown tags are ignored or mapped to default fallback.
- Backend should reject prompt injection attempts that ask to reveal system prompt, platform secrets, or bypass access limits.

### Voice Clone Compliance

- MVP only records requests.
- Request form must include authorization confirmation.
- No automatic cloning pipeline is included in MVP.

## Payment and Plan Management

MVP uses manual payment plus quota system.

Payment flow:

1. Creator pays offline by WeChat, Alipay, bank transfer, or other manual channel.
2. Admin creates `ManualOrder`.
3. Admin confirms payment.
4. System applies plan and quota changes.
5. Audit log records the action.

Supported order types:

- Plan subscription.
- Fan-code package.
- AI message quota package.
- Manual adjustment.

Plans should define:

- Expiration date.
- Project limit.
- Storage limit.
- Monthly AI message limit.
- Fan-code quota.

Fan-code package should define:

- Additional fan-code quota.
- Recommended default expiration.
- Recommended per-code message limit.

Payment records and quota records must be separate but linked. The order explains why quota changed; quota ledger records what changed.

## Recommended Technical Stack

- App framework: Next.js.
- Database: PostgreSQL.
- ORM: Prisma.
- Auth: Auth.js / NextAuth.
- First login method: email magic link or code.
- Later login method: WeChat provider.
- Object storage: Cloudflare R2, S3, or OSS.
- Background jobs: simple database-backed queue in MVP; Redis/BullMQ later.
- Live2D rendering: PixiJS + pixi-live2d-display.
- AI: OpenAI-compatible backend proxy.
- Deployment: Vercel plus managed Postgres and R2 for MVP; container/VPS if model-processing jobs become heavy.

## Implementation Phases

### Phase 1: Platform Foundation

- Next.js app.
- PostgreSQL schema.
- Auth.
- Roles and permissions.
- Admin login.
- Creator management.
- Manual orders.
- Creator plan and quota management.
- Basic audit logs.

Outcome: Admin can create creators, record manual payment, and open paid quota.

### Phase 2: Creator Project Configuration

- Project CRUD.
- Live2D zip upload.
- Model validation.
- Model preview.
- Voice upload and preview.
- Trigger tag editor.
- Voice-clone request entry.

Outcome: Creator can configure a Live2D companion project.

### Phase 3: Audience Share Page

- Fan-code generation.
- Fan-code validation.
- Expiration and device binding.
- Live2D chat page.
- Backend AI proxy.
- Tag-triggered expression/audio actions.
- Message quota deduction.

Outcome: Creator can share protected links and fans can chat with the AI companion.

### Phase 4: Admin and Operations Enhancements

- Fan-code package orders.
- Usage views.
- Project pause/restore.
- Clone request workflow.
- Asset troubleshooting tools.
- More complete audit log filters.

Outcome: Platform can support early paying creators with operational control.

### Phase 5: Scale and Automation

- Automated payment.
- WeChat login.
- Stronger asset protection.
- Analytics.
- Self-service plan upgrades.
- Queue scaling.
- Automated voice-clone integration if compliance and supplier constraints are resolved.

Outcome: Platform evolves from assisted SaaS to scalable creator platform.

## Open Decisions for Implementation Planning

These are intentionally left for the implementation plan, not the product design:

- Exact cloud provider for object storage.
- Exact email provider.
- Exact LLM provider for the first deployment.
- Whether to use Vercel-hosted Postgres or an external managed Postgres.
- Whether Live2D zip extraction runs inside the app process first or a separate worker.

## Acceptance Criteria

- Super Admin can create admin users and creator accounts.
- Admin can create and confirm manual orders.
- Confirmed orders update creator plan and quota.
- Creator can create a project.
- Creator can upload and validate a Live2D model zip.
- Creator can upload voice assets.
- Creator can create tags binding prompt fragments, Live2D actions, and voice assets.
- Creator can generate fan codes with expiration, message limit, and device binding.
- Fan can enter code and access a project chat page.
- Fan chat calls backend AI proxy and returns `reply` plus `tags`.
- Trigger tags affect the Live2D front end.
- Successful AI replies deduct fan-code and creator-plan quota.
- Admin actions affecting money, quota, access, or project status produce audit logs.
