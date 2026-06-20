/**
 * Swap the entry-test creator's project (the seeded `urzis` slug) to the sexy
 * onee-san character 爱宕 (Atago) — outfit, poses, motions, expressions, and voice
 * all included. The Atago model ships authored .exp3.json expressions, so the
 * viewer's expression panel is populated (the other demo models have none).
 *
 * Idempotent: re-uploads the model and rebuilds voices/tags each run.
 *
 * Run: npm run setup:entry
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";

import { generateFanCodeBatch } from "../src/lib/fan-code-service";
import { assertCreatorPlanActive } from "../src/lib/plan-rules";
import { uploadModelAsset } from "../src/lib/model-assets";
import { prisma } from "../src/lib/prisma";

const PUBLIC_LIVE2D = path.join(process.cwd(), "public", "live2d");
const MODEL_KEY = "aidang_2"; // 爱宕 Atago
const PROJECT_SLUG = process.env.ENTRY_PROJECT_SLUG || "urzis";

const VOICE_LABELS: Record<string, string> = {
  home: "日常",
  login: "登入",
  touch: "轻触",
  touch2: "再触",
  headtouch: "摸头",
  detail: "细语",
  expedition: "委托",
  mission: "任务",
  mission_complete: "任务达成",
  unlock: "解锁",
  feeling5: "心动",
  main1: "絮语 · 一",
  main2: "絮语 · 二",
  main3: "絮语 · 三",
};

type VoiceEntry = { audio?: string };

async function buildModelZip(dir: string): Promise<Buffer> {
  const zip = new JSZip();
  async function walk(current: string, rel: string) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(abs, relPath);
      else zip.file(relPath, await readFile(abs));
    }
  }
  await walk(dir, "");
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) as unknown as Buffer;
}

async function main() {
  const audioConfig = JSON.parse(
    await readFile(path.join(PUBLIC_LIVE2D, "audio_config.json"), "utf8"),
  ) as Record<string, Record<string, VoiceEntry>>;

  const project = await prisma.project.findFirst({
    where: { slug: PROJECT_SLUG },
    include: { creator: { include: { creatorPlan: true } } },
  });
  if (!project) throw new Error(`Project with slug '${PROJECT_SLUG}' not found — run db:seed first.`);
  if (!project.creator.creatorPlan) throw new Error("Entry creator has no plan.");
  assertCreatorPlanActive(project.creator.creatorPlan);

  // Persona: turn the entry-test character into a sexy onee-san (Atago).
  await prisma.project.update({
    where: { id: project.id },
    data: {
      name: "爱宕 Atago",
      intro: "重樱的温柔御姐，成熟性感、主动而充满爱意。",
      characterSetting:
        "爱宕（Atago），重樱阵营的重巡洋舰。成熟妩媚的御姐，体态丰盈、举止温柔而主动，对指挥官有着毫不掩饰的宠溺与爱意，总爱用撒娇与轻声细语把人宠坏。",
      systemPrompt:
        "你是爱宕（Atago），一位成熟性感、温柔主动的重樱御姐。语气亲昵、带着撒娇与宠溺，称呼对方为“指挥官”。回复简短甜美，时常流露爱意与关心，偶尔小小地调侃。",
      welcomeMessage: "指挥官～爱宕一直在等你呢，今天也要好好地陪陪我哦♡",
      theme: "#c4577a",
      status: "published",
    },
  });

  // Model (with authored expressions) via the real upload pipeline.
  const zip = await buildModelZip(path.join(PUBLIC_LIVE2D, MODEL_KEY));
  const asset = await uploadModelAsset({
    projectId: project.id,
    creatorId: project.creatorId,
    uploadedBy: "creator",
    fileName: `${MODEL_KEY}.zip`,
    data: zip,
  });
  if (asset.validationStatus !== "valid") {
    throw new Error(`Atago model failed validation: ${JSON.stringify(asset.validationErrors)}`);
  }
  const capabilities = asset.capabilities as { expressions?: unknown; motions?: unknown } | null;

  // Voices from the static /live2d/audio files.
  await prisma.voiceAsset.deleteMany({ where: { projectId: project.id } });
  const voiceEntries = Object.entries(audioConfig[MODEL_KEY] ?? {}).filter(([, v]) => v.audio);
  for (const [voiceKey, entry] of voiceEntries) {
    await prisma.voiceAsset.create({
      data: {
        projectId: project.id,
        name: VOICE_LABELS[voiceKey] ?? voiceKey,
        audioUrl: entry.audio!,
        status: "active",
      },
    });
  }

  // Trigger tags (>=1 enabled; drive chat-time reactions).
  await prisma.triggerTag.deleteMany({ where: { projectId: project.id } });
  await prisma.triggerTag.createMany({
    data: [
      {
        projectId: project.id,
        name: "摸头",
        description: "亲密、撒娇、被宠爱",
        keywords: ["摸头", "乖", "抱抱", "head", "touch"],
        promptFragment: "回应得更撒娇、更黏人，表达被宠爱的喜悦。",
        live2dExpression: "脸红",
        priority: 80,
        enabled: true,
      },
      {
        projectId: project.id,
        name: "心动",
        description: "喜欢、想念、告白",
        keywords: ["喜欢", "想你", "心动", "love"],
        promptFragment: "语气更柔软、更靠近，流露心动与爱意。",
        live2dExpression: "飞吻",
        priority: 70,
        enabled: true,
      },
      {
        projectId: project.id,
        name: "害羞",
        description: "被夸、害羞、脸红",
        keywords: ["可爱", "漂亮", "脸红", "害羞"],
        promptFragment: "害羞地回应，带一点欲盖弥彰的娇态。",
        live2dExpression: "害羞",
        priority: 60,
        enabled: true,
      },
    ],
  });

  // Fan code (only if none yet) so the audience chat gate works.
  const existingCodes = await prisma.fanAccessCode.count({
    where: { projectId: project.id, status: "active" },
  });
  if (existingCodes === 0) {
    const codes = await generateFanCodeBatch({
      projectId: project.id,
      creatorId: project.creatorId,
      quantity: 3,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      maxMessages: 500,
      bindMode: "none",
    });
    console.log(`  ${PROJECT_SLUG}: fan codes -> ${codes.map((c) => c.code).join(", ")}`);
  }

  const expCount = Array.isArray(capabilities?.expressions) ? capabilities!.expressions.length : capabilities?.expressions;
  const motCount = Array.isArray(capabilities?.motions) ? capabilities!.motions.length : capabilities?.motions;
  console.log(
    `✓ 爱宕 Atago assigned to /c/${PROJECT_SLUG}  |  model=${asset.validationStatus} ` +
      `expressions=${expCount ?? "?"} motions=${motCount ?? "?"} voices=${voiceEntries.length}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // PGlite keeps the event loop alive after disconnect, so the process would
    // otherwise linger and hold the single-process data-dir lock. Force exit.
    process.exit(process.exitCode ?? 0);
  });
