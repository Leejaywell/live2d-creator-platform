// End-to-end "run-through" proof for the creator self-service flow, exercised
// against the real local stack (Postgres + MinIO). Creates a throwaway creator
// with NO plan and drives the full journey, asserting each step, then cleans up.
//
// Run: set -a; . ./.env; set +a; npx tsx scripts/creator-journey-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "../src/lib/prisma";
import { ensureCreatorPlan } from "../src/lib/creator-onboarding";
import { createProject, createTriggerTag, setProjectStatus } from "../src/lib/projects";
import { uploadModelAsset } from "../src/lib/model-assets";
import { uploadVoiceAsset } from "../src/lib/voice-assets";
import { generateFanCodeBatch, validateFanCode } from "../src/lib/fan-code-service";
import { buildTriggeredVoiceAssets } from "../src/lib/chat-effects";

const MODEL_ZIP = process.env.QA_MODEL_ZIP_PATH || "/tmp/l2d/izumi-model.zip";
const VOICE_WAV = process.env.JOURNEY_VOICE_PATH || "/tmp/l2d/serve/izumi/runtime/sounds/izumi_01.wav";
const slug = `journey-${Date.now().toString(36)}`;

async function main() {
  const email = `journey-${Date.now()}@example.test`;
  const creator = await prisma.user.create({ data: { email, role: "creator", status: "active" } });
  console.log(`1. fresh creator ${email} (no plan)`);

  try {
    const plan = await ensureCreatorPlan(creator.id);
    assert.equal(plan.tier, "trial", "new creator should get a trial plan");
    console.log(`2. ensureCreatorPlan -> trial plan (maxProjects=${plan.maxProjects})  PASS`);

    const project = await createProject({
      creatorId: creator.id,
      name: "旅程测试",
      slug,
      intro: "端到端旅程测试角色。",
      systemPrompt: "你是测试角色。",
      welcomeMessage: "你好。",
    });
    assert.equal(project.status, "draft");
    console.log(`3. createProject (self-serve, no admin plan needed)  PASS`);

    const model = await uploadModelAsset({
      projectId: project.id,
      creatorId: creator.id,
      fileName: "izumi.zip",
      data: readFileSync(MODEL_ZIP),
      uploadedBy: "creator",
    });
    assert.equal(model.validationStatus, "valid", "model must validate");
    const caps = model.capabilities as { expressions: { name: string }[] } | null;
    assert.ok(caps && caps.expressions.length > 0, "capabilities must be parsed");
    const blush = caps.expressions.find((e) => /blush/i.test(e.name));
    console.log(`4. uploadModelAsset -> valid, ${caps.expressions.length} expressions parsed (e.g. ${blush?.name ?? caps.expressions[0].name})  PASS`);

    const voice = await uploadVoiceAsset({
      projectId: project.id,
      creatorId: creator.id,
      name: "脸红语音",
      fileName: path.basename(VOICE_WAV),
      contentType: "audio/wav",
      data: readFileSync(VOICE_WAV),
    });
    console.log(`5. uploadVoiceAsset  PASS`);

    const tag = await createTriggerTag({
      projectId: project.id,
      creatorId: creator.id,
      name: "脸红",
      keywords: ["想你", "喜欢"],
      promptFragment: "更亲密。",
      live2dParams: [{ id: "Param5", value: 1 }],
      voiceAssetIds: [voice.id],
    });
    const boundTag = await prisma.triggerTag.findUniqueOrThrow({ where: { id: tag.id }, include: { voiceAssets: true } });
    assert.equal(boundTag.voiceAssets.length, 1, "voice must be bound to tag via relation");
    assert.equal(boundTag.voiceAssets[0].id, voice.id);
    console.log(`6. createTriggerTag + bind voice via relation  PASS`);

    const codes = await generateFanCodeBatch({
      projectId: project.id,
      creatorId: creator.id,
      quantity: 2,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxMessages: 50,
      bindMode: "none",
    });
    assert.equal(codes.length, 2);
    console.log(`7. generateFanCodeBatch -> ${codes.length} codes  PASS`);

    const published = await setProjectStatus({
      projectId: project.id,
      creatorId: creator.id,
      actorId: creator.id,
      actorRole: "creator",
      status: "published",
    });
    assert.equal(published.status, "published");
    console.log(`8. publish (passes model-required gate)  PASS`);

    const session = await validateFanCode({
      projectSlug: slug,
      code: codes[0].code,
      browserDeviceId: "journey-device",
      userAgent: "journey-agent",
    });
    assert.ok(session.viewerSessionId, "fan code must unlock a viewer session");
    console.log(`9. validateFanCode -> viewer session unlocked  PASS`);

    const triggerTags = await prisma.triggerTag.findMany({
      where: { projectId: project.id, enabled: true },
      include: { voiceAssets: { where: { status: "active" } } },
    });
    const triggered = buildTriggeredVoiceAssets({
      tags: ["脸红"],
      triggerTags,
      viewerSessionId: session.viewerSessionId,
    });
    assert.equal(triggered.length, 1, "audience trigger must return the bound voice");
    assert.equal(triggered[0].id, voice.id);
    console.log(`10. audience trigger '脸红' -> plays bound voice  PASS`);

    console.log("\n✅ FULL CREATOR JOURNEY RUNS THROUGH END-TO-END");
  } finally {
    await prisma.user.delete({ where: { id: creator.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("\n❌ JOURNEY FAILED:", error);
  process.exit(1);
});
