# Creator Self-Service — Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the data model and backend services so a creator can self-serve (auto trial plan), so trigger tags bind voices via the relation and expressions via real model capabilities, and so model upload records model capabilities — the backend foundation the rebuilt creator UI builds on.

**Architecture:** Keep the existing `src/lib/*` service layer and Prisma; make targeted changes. Pure logic goes in small, unit-tested helper modules (the codebase's established pattern: pure functions are unit-tested with `node:test`, Prisma wrappers are thin and verified by build + the E2E run-through later). The schema is reshaped directly (project never deployed) via `prisma migrate reset`.

**Tech Stack:** Next.js 16, React 19, Prisma 7 (Postgres), Zod, `node:test` + `tsx`. Local stack: docker Postgres/MinIO/Mailpit.

This is **Plan 1 of 4** for Phase 1 (see "Subsequent Plans" at the end).

---

## File Structure

**Create**
- `apps/web/src/lib/trial-plan.ts` — trial-plan constants + `buildTrialPlanData()` (pure).
- `apps/web/src/lib/creator-onboarding.ts` — `ensureCreatorPlan()` (Prisma wrapper).
- `apps/web/src/lib/model-capabilities.ts` — `parseModelCapabilities()` (pure).
- `apps/web/src/lib/tag-voice-binding.ts` — `setTagVoicesData()` (pure) + `bindVoicesToTag()` (Prisma wrapper).
- `apps/web/tests/trial-plan.test.ts`
- `apps/web/tests/model-capabilities.test.ts`
- `apps/web/tests/tag-voice-binding.test.ts`

**Modify**
- `apps/web/prisma/schema.prisma` — add `PlanTier`, `CreatorPlan.tier`, `ModelAsset.capabilities`, `TriggerTag.expressionName`; remove `VoiceAsset.tags`.
- `apps/web/src/lib/voice-assets.ts:71,158` — stop writing `VoiceAsset.tags`.
- `apps/web/src/app/api/assets/tap-voices/route.ts:24,44` — stop selecting/returning `VoiceAsset.tags`.
- `apps/web/src/lib/model-assets.ts` — store parsed `capabilities` on `ModelAsset.create`.
- `apps/web/prisma/seed.ts` — give the seed creator a trial-tier plan; bind seed voices to tags via the relation (not the string array).

---

## Task 1: Reshape the Prisma schema and keep the build green

**Files:**
- Modify: `apps/web/prisma/schema.prisma`
- Modify: `apps/web/src/lib/voice-assets.ts:71,158`
- Modify: `apps/web/src/app/api/assets/tap-voices/route.ts:24,44`

- [ ] **Step 1: Add the `PlanTier` enum and `CreatorPlan.tier`**

In `apps/web/prisma/schema.prisma`, add this enum next to the other enums:

```prisma
enum PlanTier {
  trial
  paid
}
```

In `model CreatorPlan`, add the field (after `status`):

```prisma
  tier                  PlanTier   @default(trial)
```

- [ ] **Step 2: Add `ModelAsset.capabilities` and `TriggerTag.expressionName`, remove `VoiceAsset.tags`**

In `model ModelAsset`, add after `validationErrors`:

```prisma
  capabilities      Json?
```

In `model TriggerTag`, add after `live2dExpression`:

```prisma
  expressionName   String?
```

In `model VoiceAsset`, delete this line:

```prisma
  tags        String[]
```

- [ ] **Step 3: Remove `tags` writes in `voice-assets.ts`**

In `apps/web/src/lib/voice-assets.ts`, in `uploadVoiceAsset` (~line 71) delete the line `tags: input.tags ?? [],` from the `voiceAsset.create` data. In `replaceVoiceAssetAudio` (~line 158) delete `tags: input.tags,`. Leave the `tags?: string[]` input params in place for now (harmless; binding moves to the relation in Task 4) but stop persisting them.

- [ ] **Step 4: Remove `tags` from the tap-voices route**

In `apps/web/src/app/api/assets/tap-voices/route.ts`: in the `select` (line ~24) remove `, tags: true`; in the mapped result (line ~44) remove the `tags: voice.tags,` line.

- [ ] **Step 5: Reset the database and regenerate the client**

Run:
```bash
cd apps/web && set -a && . ./.env && set +a && npx prisma validate && npx prisma migrate reset --force --skip-seed && npx prisma generate
```
Expected: `The schema at prisma/schema.prisma is valid`, then the database is reset and the client regenerates without error.

- [ ] **Step 6: Verify the existing test suite still passes**

Run: `cd apps/web && npm test`
Expected: all tests pass (172+), no references to `VoiceAsset.tags` remain.

- [ ] **Step 7: Commit**

```bash
git add apps/web/prisma/schema.prisma apps/web/src/lib/voice-assets.ts apps/web/src/app/api/assets/tap-voices/route.ts
git commit -m "refactor: reshape schema for self-serve plans, model capabilities, tag-voice relation"
```

---

## Task 2: Trial-plan defaults and `ensureCreatorPlan`

**Files:**
- Create: `apps/web/src/lib/trial-plan.ts`
- Create: `apps/web/src/lib/creator-onboarding.ts`
- Test: `apps/web/tests/trial-plan.test.ts`

- [ ] **Step 1: Write the failing test for `buildTrialPlanData`**

Create `apps/web/tests/trial-plan.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { TRIAL_PLAN_DEFAULTS, buildTrialPlanData } from "../src/lib/trial-plan";

const now = new Date("2026-06-12T00:00:00.000Z");

test("buildTrialPlanData produces an active trial plan for the creator", () => {
  const data = buildTrialPlanData("creator-1", now);
  assert.equal(data.creatorId, "creator-1");
  assert.equal(data.tier, "trial");
  assert.equal(data.status, "active");
  assert.equal(data.planName, TRIAL_PLAN_DEFAULTS.planName);
  assert.equal(data.maxProjects, TRIAL_PLAN_DEFAULTS.maxProjects);
  assert.equal(data.startsAt.toISOString(), now.toISOString());
});

test("buildTrialPlanData sets expiry to the configured trial length", () => {
  const data = buildTrialPlanData("creator-1", now);
  const expectedExpiry = new Date(now.getTime() + TRIAL_PLAN_DEFAULTS.durationDays * 24 * 60 * 60 * 1000);
  assert.equal(data.expiresAt.toISOString(), expectedExpiry.toISOString());
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && npx tsx --test tests/trial-plan.test.ts`
Expected: FAIL — cannot find module `../src/lib/trial-plan`.

- [ ] **Step 3: Implement `trial-plan.ts`**

Create `apps/web/src/lib/trial-plan.ts`:

```ts
export const TRIAL_PLAN_DEFAULTS = {
  planName: "试用",
  maxProjects: 1,
  storageLimitMb: 256,
  monthlyAiMessageLimit: 300,
  fanCodeQuota: 30,
  durationDays: 30,
} as const;

export function buildTrialPlanData(creatorId: string, now = new Date()) {
  return {
    creatorId,
    planName: TRIAL_PLAN_DEFAULTS.planName,
    tier: "trial" as const,
    status: "active" as const,
    startsAt: now,
    expiresAt: new Date(now.getTime() + TRIAL_PLAN_DEFAULTS.durationDays * 24 * 60 * 60 * 1000),
    maxProjects: TRIAL_PLAN_DEFAULTS.maxProjects,
    storageLimitMb: TRIAL_PLAN_DEFAULTS.storageLimitMb,
    monthlyAiMessageLimit: TRIAL_PLAN_DEFAULTS.monthlyAiMessageLimit,
    fanCodeQuota: TRIAL_PLAN_DEFAULTS.fanCodeQuota,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && npx tsx --test tests/trial-plan.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Implement `ensureCreatorPlan` (idempotent Prisma wrapper)**

Create `apps/web/src/lib/creator-onboarding.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { buildTrialPlanData } from "@/lib/trial-plan";

// Idempotently guarantees the creator has a plan. New creators get a trial
// plan so they can self-serve without an admin opening one first. Existing
// plans (trial or paid) are left untouched.
export async function ensureCreatorPlan(creatorId: string, now = new Date()) {
  const existing = await prisma.creatorPlan.findUnique({ where: { creatorId } });
  if (existing) return existing;
  return prisma.creatorPlan.create({ data: buildTrialPlanData(creatorId, now) });
}
```

- [ ] **Step 6: Verify it type-checks**

Run: `cd apps/web && npx tsc --noEmit --pretty false 2>&1 | grep -E "creator-onboarding|trial-plan" || echo "no type errors in new files"`
Expected: `no type errors in new files`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/trial-plan.ts apps/web/src/lib/creator-onboarding.ts apps/web/tests/trial-plan.test.ts
git commit -m "feat: auto trial plan via ensureCreatorPlan for self-serve onboarding"
```

---

## Task 3: Parse model capabilities and record them on upload

**Files:**
- Create: `apps/web/src/lib/model-capabilities.ts`
- Test: `apps/web/tests/model-capabilities.test.ts`
- Modify: `apps/web/src/lib/model-assets.ts`

- [ ] **Step 1: Write the failing test for `parseModelCapabilities`**

Create `apps/web/tests/model-capabilities.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { parseModelCapabilities } from "../src/lib/model-capabilities";

test("parseModelCapabilities extracts named expressions and motion groups", () => {
  const model3 = {
    Version: 3,
    FileReferences: {
      Moc: "m.moc3",
      Expressions: [
        { Name: "Blushing", File: "expressions/Blushing.exp3.json" },
        { Name: "Smile", File: "expressions/Smile.exp3.json" },
      ],
      Motions: {
        Tap: [{ File: "motion/izumi_02.motion3.json" }, { File: "motion/izumi_05.motion3.json" }],
        Idle: [{ File: "motion/izumi_03.motion3.json" }],
      },
    },
  };
  const caps = parseModelCapabilities(model3);
  assert.deepEqual(caps.expressions, [
    { name: "Blushing", file: "expressions/Blushing.exp3.json" },
    { name: "Smile", file: "expressions/Smile.exp3.json" },
  ]);
  assert.deepEqual(
    caps.motions.map((m) => `${m.group}#${m.index}`),
    ["Tap#0", "Tap#1", "Idle#0"],
  );
});

test("parseModelCapabilities handles a single unnamed motion group and no expressions", () => {
  const model3 = {
    Version: 3,
    FileReferences: { Moc: "b.moc3", Motions: { "": [{ File: "motions/idle.motion3.json" }, { File: "motions/touch_head.motion3.json" }] } },
  };
  const caps = parseModelCapabilities(model3);
  assert.deepEqual(caps.expressions, []);
  assert.equal(caps.motions.length, 2);
  assert.equal(caps.motions[1].group, "");
  assert.equal(caps.motions[1].file, "motions/touch_head.motion3.json");
});

test("parseModelCapabilities returns empty capabilities for malformed input", () => {
  assert.deepEqual(parseModelCapabilities(null), { expressions: [], motions: [] });
  assert.deepEqual(parseModelCapabilities({}), { expressions: [], motions: [] });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && npx tsx --test tests/model-capabilities.test.ts`
Expected: FAIL — cannot find module `../src/lib/model-capabilities`.

- [ ] **Step 3: Implement `model-capabilities.ts`**

Create `apps/web/src/lib/model-capabilities.ts`:

```ts
export type ModelExpression = { name: string; file: string };
export type ModelMotion = { group: string; index: number; file: string };
export type ModelCapabilities = { expressions: ModelExpression[]; motions: ModelMotion[] };

type Unknown = Record<string, unknown>;
const isRecord = (v: unknown): v is Unknown => typeof v === "object" && v !== null;

// Parses a Cubism 4 model3.json object into the expressions and motions a
// creator can bind trigger tags to. Tolerant of missing/odd shapes (e.g. Azur
// Lane models with a single unnamed motion group and no expressions).
export function parseModelCapabilities(model3: unknown): ModelCapabilities {
  const empty: ModelCapabilities = { expressions: [], motions: [] };
  if (!isRecord(model3)) return empty;
  const fr = model3.FileReferences;
  if (!isRecord(fr)) return empty;

  const expressions: ModelExpression[] = Array.isArray(fr.Expressions)
    ? fr.Expressions.flatMap((e) =>
        isRecord(e) && typeof e.File === "string"
          ? [{ name: typeof e.Name === "string" ? e.Name : e.File, file: e.File }]
          : [],
      )
    : [];

  const motions: ModelMotion[] = [];
  if (isRecord(fr.Motions)) {
    for (const [group, list] of Object.entries(fr.Motions)) {
      if (!Array.isArray(list)) continue;
      list.forEach((item, index) => {
        if (isRecord(item) && typeof item.File === "string") {
          motions.push({ group, index, file: item.File });
        }
      });
    }
  }

  return { expressions, motions };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && npx tsx --test tests/model-capabilities.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Record capabilities when a valid model is uploaded**

In `apps/web/src/lib/model-assets.ts`: add the import at the top with the other `@/lib` imports:

```ts
import { parseModelCapabilities } from "@/lib/model-capabilities";
```

Find where the model3 JSON is available during a valid upload. The validation already parses it; expose it by parsing the extracted model3 file. Just before the `modelAsset.create` call, compute capabilities from the extracted model3 file:

```ts
    const modelJsonFile = validation.ok
      ? extractedFiles.find((file) => file.path === validation.modelJsonPath)
      : undefined;
    const capabilities = modelJsonFile
      ? parseModelCapabilities(JSON.parse(modelJsonFile.data.toString("utf8")))
      : null;
```

Then in the `modelAsset.create` `data` object, add (next to `validationStatus`):

```ts
        capabilities: capabilities as Prisma.InputJsonValue | undefined,
```

(`Prisma` is already imported in this file.)

- [ ] **Step 6: Verify type-check and existing tests pass**

Run: `cd apps/web && npx tsc --noEmit --pretty false 2>&1 | grep -E "model-assets|model-capabilities" || echo "ok"; npm test`
Expected: `ok` and all tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/model-capabilities.ts apps/web/tests/model-capabilities.test.ts apps/web/src/lib/model-assets.ts
git commit -m "feat: parse and store Live2D model capabilities on upload"
```

---

## Task 4: Bind voices to tags via the relation

**Files:**
- Create: `apps/web/src/lib/tag-voice-binding.ts`
- Test: `apps/web/tests/tag-voice-binding.test.ts`

- [ ] **Step 1: Write the failing test for `setTagVoicesData`**

Create `apps/web/tests/tag-voice-binding.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { setTagVoicesData } from "../src/lib/tag-voice-binding";

test("setTagVoicesData builds a Prisma set payload from voice ids", () => {
  assert.deepEqual(setTagVoicesData(["v1", "v2"]), { voiceAssets: { set: [{ id: "v1" }, { id: "v2" }] } });
});

test("setTagVoicesData clears bindings when given no ids", () => {
  assert.deepEqual(setTagVoicesData([]), { voiceAssets: { set: [] } });
});

test("setTagVoicesData de-duplicates ids", () => {
  assert.deepEqual(setTagVoicesData(["v1", "v1", "v2"]), { voiceAssets: { set: [{ id: "v1" }, { id: "v2" }] } });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && npx tsx --test tests/tag-voice-binding.test.ts`
Expected: FAIL — cannot find module `../src/lib/tag-voice-binding`.

- [ ] **Step 3: Implement `tag-voice-binding.ts`**

Create `apps/web/src/lib/tag-voice-binding.ts`:

```ts
import { prisma } from "@/lib/prisma";

// The TriggerTag <-> VoiceAsset M2M relation is the single source of truth the
// chat/tap runtime reads (chat-effects.buildTriggeredVoiceAssets). This builds
// the Prisma `set` payload that makes a tag's bound voices exactly `voiceIds`.
export function setTagVoicesData(voiceIds: string[]) {
  const unique = Array.from(new Set(voiceIds));
  return { voiceAssets: { set: unique.map((id) => ({ id })) } };
}

// Replaces a tag's voice bindings, scoped to the owning creator/project so a
// creator can only bind their own voices to their own tags.
export async function bindVoicesToTag(input: {
  projectId: string;
  creatorId: string;
  tagId: string;
  voiceAssetIds: string[];
}) {
  return prisma.$transaction(async (tx) => {
    await tx.triggerTag.findFirstOrThrow({
      where: { id: input.tagId, project: { id: input.projectId, creatorId: input.creatorId } },
    });
    if (input.voiceAssetIds.length) {
      const owned = await tx.voiceAsset.count({
        where: { id: { in: input.voiceAssetIds }, projectId: input.projectId },
      });
      if (owned !== new Set(input.voiceAssetIds).size) {
        throw new Error("One or more voice assets do not belong to this project");
      }
    }
    return tx.triggerTag.update({
      where: { id: input.tagId },
      data: setTagVoicesData(input.voiceAssetIds),
    });
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && npx tsx --test tests/tag-voice-binding.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify type-check**

Run: `cd apps/web && npx tsc --noEmit --pretty false 2>&1 | grep -E "tag-voice-binding" || echo "ok"`
Expected: `ok`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/tag-voice-binding.ts apps/web/tests/tag-voice-binding.test.ts
git commit -m "feat: bind voices to trigger tags via the relation (single source of truth)"
```

---

## Task 5: Update the seed to use trial tier and relation bindings

**Files:**
- Modify: `apps/web/prisma/seed.ts`

- [ ] **Step 1: Give the seed creator a trial-tier plan**

In `apps/web/prisma/seed.ts`, in the `creatorPlan.upsert` `create` block, add `tier: "trial",` next to `planName`. (Leave the generous demo limits; only the tier field is added so the schema is satisfied and the demo creator reads as self-serve.)

- [ ] **Step 2: Bind seed voices to tags via the relation**

If the seed creates voices and tags, replace any `tags: [...]` string assignment on voice creation with a relation connect after both exist, e.g.:

```ts
await prisma.triggerTag.update({
  where: { id: blushTag.id },
  data: { voiceAssets: { connect: { id: blushVoice.id } } },
});
```

If the current seed does not create voices, skip this step (no change needed).

- [ ] **Step 3: Reset + reseed and verify**

Run:
```bash
cd apps/web && set -a && . ./.env && set +a && npx prisma migrate reset --force && npm run db:seed
```
Expected: reset succeeds and seed prints its summary line without error.

- [ ] **Step 4: Commit**

```bash
git add apps/web/prisma/seed.ts
git commit -m "chore: seed trial-tier plan and relation-based voice bindings"
```

---

## Task 6: Full backend verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole unit suite**

Run: `cd apps/web && npm test`
Expected: all tests pass, including the 3 new test files (trial-plan, model-capabilities, tag-voice-binding).

- [ ] **Step 2: Type-check the whole app**

Run: `cd apps/web && npx tsc --noEmit --pretty false`
Expected: no errors.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A && git commit -m "test: backend foundation green" --allow-empty
```

---

## Self-Review Notes (addressed)

- **Spec coverage (Section 2):** ① self-serve plan → Task 2 (`ensureCreatorPlan` + trial defaults) + Task 5 (seed tier). ② tag↔voice → Task 4 (relation binding) + Task 1 (drop `VoiceAsset.tags`); tag↔expression → Task 3 (`parseModelCapabilities` + stored capabilities), with the viewer's hardcoded params removed in Plan 3. ③ model upload validation/capabilities → Task 3 (capabilities recorded). ④ fan-code distribution is UI/Server-Action work → Plan 3 (services already exist).
- **Type consistency:** `TRIAL_PLAN_DEFAULTS`, `buildTrialPlanData`, `parseModelCapabilities` (returns `{expressions, motions}`), `setTagVoicesData`/`bindVoicesToTag` names are used consistently across tasks.
- **Placeholders:** none — every code step shows full code.

---

## Subsequent Plans (Phase 1 remainder)

Each will be written as its own detailed plan before execution, and each produces working, testable software:

- **Plan 2 — Glass design system:** `tokens.css` + Radix-based glass component library (`apps/web/src/components/ui/*`), with visual-regression screenshots. Removes the viewer's hardcoded `expressionParams` (runtime applies server params only).
- **Plan 3 — Server Actions + creator pages:** sign-in, `/creator` dashboard (auto `ensureCreatorPlan` on load), and the project workspace (step rail + persistent `Live2DStage` + the five modules), wired to the Plan 1 services via Server Actions.
- **Plan 4 — End-to-end run-through:** the Playwright creator journey (sign-in → create → upload → tags+voice → codes → publish → audience cross-check) against the local-mocked stack, plus visual/a11y checks. This is the "跑通" acceptance gate.
