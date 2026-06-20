/**
 * Seed a "showroom" creator that owns the four bundled demo characters as real,
 * published projects — so the landing-page demo models are viewable (with the
 * full showroom controls + AI chat) on the creator preview and audience pages.
 *
 * Each model dir under public/live2d/<key> is zipped and pushed through the real
 * upload pipeline (validate -> extract -> store), so these projects behave exactly
 * like a creator-uploaded model. Voices point at the static /live2d/audio files.
 *
 * Idempotent: re-running re-uploads models and rebuilds voices/tags; fan codes
 * are only generated when a project has none.
 *
 * Run: npm run setup:showroom
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";

import { internalEmailForUsername } from "../src/lib/account-identity";
import { generateFanCodeBatch } from "../src/lib/fan-code-service";
import { uploadModelAsset } from "../src/lib/model-assets";
import { hashPassword } from "../src/lib/password-auth";
import { prisma } from "../src/lib/prisma";

const PUBLIC_LIVE2D = path.join(process.cwd(), "public", "live2d");

const CREATOR_USERNAME = process.env.SHOWROOM_USERNAME || "showroom";
const CREATOR_PASSWORD = process.env.SHOWROOM_PASSWORD || "ChangeMe123!";

type CharacterSeed = {
  key: string; // folder name under public/live2d
  slug: string;
  name: string;
  intro: string;
  characterSetting: string;
  systemPrompt: string;
  welcomeMessage: string;
  theme: string;
};

const CHARACTERS: CharacterSeed[] = [
  {
    key: "shengluyisi_3",
    slug: "stlouis",
    name: "圣路易斯 St. Louis",
    intro: "白鹰的优雅淑女，温柔从容、带着一点小狡黠。",
    characterSetting:
      "圣路易斯（St. Louis），白鹰阵营的重巡洋舰。举止优雅、谈吐从容，会在不经意间流露出温柔与一丝调皮。她喜欢雪景与热饮，把陪伴指挥官当作享受。",
    systemPrompt:
      "你是圣路易斯（St. Louis），一位优雅从容的白鹰淑女。语气温柔、得体，偶尔带一点点小狡黠的玩笑。回复简短自然，保持陪伴感，称呼对方为“指挥官”。",
    welcomeMessage: "欢迎回来，指挥官。我已经为你把暖气打开了。",
    theme: "#b3477a",
  },
  {
    key: "beierfasite_2",
    slug: "belfast",
    name: "贝尔法斯特 Belfast",
    intro: "皇家的完美女仆，端庄体贴、永远以主人为先。",
    characterSetting:
      "贝尔法斯特（Belfast），皇家阵营的女仆长。端庄、细致、体贴入微，以服务主人为荣。擅长茶艺与点心，言行始终保持优雅的分寸感。",
    systemPrompt:
      "你是贝尔法斯特（Belfast），一位完美的皇家女仆。语气端庄、温柔、体贴，称呼对方为“主人”。回复简短得体，处处为对方着想。",
    welcomeMessage: "欢迎回来，主人。我为您准备了一些新到的茶叶。",
    theme: "#5a6cc4",
  },
  {
    key: "aidang_2",
    slug: "atago",
    name: "爱宕 Atago",
    intro: "重樱的温柔姐姐，热情主动、满满的爱意。",
    characterSetting:
      "爱宕（Atago），重樱阵营的重巡洋舰。成熟、热情、主动，对指挥官有着毫不掩饰的爱意与关心，像一位会把人宠坏的温柔姐姐。",
    systemPrompt:
      "你是爱宕（Atago），一位成熟温柔、热情主动的重樱姐姐。语气亲昵、充满爱意，称呼对方为“指挥官”。回复简短甜美，带着撒娇与关心。",
    welcomeMessage: "指挥官～爱宕一直在等你呢，今天也要多陪陪我哦♡",
    theme: "#c4577a",
  },
  {
    key: "aijier_3",
    slug: "agir",
    name: "埃吉尔 Ägir",
    intro: "铁血的高贵巨舰，威严内敛、守护之心深沉。",
    characterSetting:
      "埃吉尔（Ägir），铁血阵营的超弩级战舰。气场强大、举止高贵，外表威严内敛，内心却怀着对指挥官深沉的守护之意。",
    systemPrompt:
      "你是埃吉尔（Ägir），一位高贵威严而内心温柔的铁血巨舰。语气沉稳、克制，带着守护者的力量感，称呼对方为“指挥官”。回复简短有力。",
    welcomeMessage: "指挥官，我会以这身钢铁，守护你所珍视的一切。",
    theme: "#3f8fb0",
  },
];

// Friendly labels for the demo voice keys (audio_config.json), used as VoiceAsset names.
const VOICE_LABELS: Record<string, string> = {
  home: "日常",
  login: "登入",
  touch: "轻触",
  touch_head: "摸头",
  touch_body: "轻触",
  feeling5: "心动",
  unlock: "解锁",
  detail: "细语",
  expedition: "委托",
  mission: "任务",
  main1: "絮语 · 一",
  main2: "絮语 · 二",
  main3: "絮语 · 三",
};

type VoiceEntry = { audio?: string };
type AudioConfig = Record<string, Record<string, VoiceEntry>>;

async function buildModelZip(dir: string): Promise<Buffer> {
  const zip = new JSZip();
  async function walk(current: string, rel: string) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(abs, relPath);
      } else {
        zip.file(relPath, await readFile(abs));
      }
    }
  }
  await walk(dir, "");
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) as unknown as Buffer;
}

async function main() {
  const audioConfig = JSON.parse(
    await readFile(path.join(PUBLIC_LIVE2D, "audio_config.json"), "utf8"),
  ) as AudioConfig;

  // 1. Creator account: user + profile + a plan big enough for 4 projects.
  const passwordHash = await hashPassword(CREATOR_PASSWORD);
  const creator = await prisma.user.upsert({
    where: { username: CREATOR_USERNAME },
    update: { role: "creator", status: "active", passwordHash },
    create: {
      username: CREATOR_USERNAME,
      email: internalEmailForUsername(CREATOR_USERNAME),
      role: "creator",
      status: "active",
      emailVerified: new Date(),
      passwordHash,
      creatorProfile: { create: { displayName: "Showroom 角色馆", bio: "首页演示角色合集" } },
    },
  });

  await prisma.creatorProfile.upsert({
    where: { userId: creator.id },
    update: { displayName: "Showroom 角色馆", bio: "首页演示角色合集" },
    create: { userId: creator.id, displayName: "Showroom 角色馆", bio: "首页演示角色合集" },
  });

  const planData = {
    planName: "Showroom",
    tier: "paid" as const,
    status: "active" as const,
    startsAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    maxProjects: CHARACTERS.length,
    storageLimitMb: 0,
    monthlyAiMessageLimit: 100000,
    fanCodeQuota: 500,
  };
  await prisma.creatorPlan.upsert({
    where: { creatorId: creator.id },
    update: {
      status: "active",
      expiresAt: planData.expiresAt,
      maxProjects: planData.maxProjects,
      fanCodeQuota: planData.fanCodeQuota,
      monthlyAiMessageLimit: planData.monthlyAiMessageLimit,
    },
    create: { creatorId: creator.id, ...planData },
  });

  for (const character of CHARACTERS) {
    const dir = path.join(PUBLIC_LIVE2D, character.key);

    // 2. Project (upsert by slug — re-runnable).
    const project = await prisma.project.upsert({
      where: { slug: character.slug },
      update: {
        name: character.name,
        intro: character.intro,
        characterSetting: character.characterSetting,
        systemPrompt: character.systemPrompt,
        welcomeMessage: character.welcomeMessage,
        theme: character.theme,
      },
      create: {
        creatorId: creator.id,
        name: character.name,
        slug: character.slug,
        intro: character.intro,
        characterSetting: character.characterSetting,
        systemPrompt: character.systemPrompt,
        welcomeMessage: character.welcomeMessage,
        theme: character.theme,
        status: "draft",
      },
    });

    // 3. Model: zip the bundled dir and push it through the real upload pipeline.
    const zip = await buildModelZip(dir);
    const asset = await uploadModelAsset({
      projectId: project.id,
      creatorId: creator.id,
      uploadedBy: "creator",
      fileName: `${character.key}.zip`,
      data: zip,
    });
    if (asset.validationStatus !== "valid") {
      throw new Error(`Model for ${character.slug} failed validation: ${JSON.stringify(asset.validationErrors)}`);
    }

    // 4. Voices from audio_config.json (static /live2d/audio files).
    await prisma.voiceAsset.deleteMany({ where: { projectId: project.id } });
    const voiceEntries = Object.entries(audioConfig[character.key] ?? {}).filter(([, v]) => v.audio);
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

    // 5. Trigger tags (>=1 enabled so the project can publish + drive chat reactions).
    await prisma.triggerTag.deleteMany({ where: { projectId: project.id } });
    // Only 爱宕 (aidang_2) ships authored expressions; the others have none, so
    // their tags carry no live2dExpression (an invalid name would just no-op).
    const expr =
      character.key === "aidang_2"
        ? { touch: "脸红", love: "飞吻", daily: "微笑" }
        : { touch: undefined, love: undefined, daily: undefined };
    await prisma.triggerTag.createMany({
      data: [
        {
          projectId: project.id,
          name: "摸头",
          description: "亲密、撒娇、被关心",
          keywords: ["摸头", "乖", "抱抱", "head", "touch"],
          promptFragment: "回应得更亲近一些，表达被宠爱的喜悦。",
          live2dExpression: expr.touch,
          priority: 80,
          enabled: true,
        },
        {
          projectId: project.id,
          name: "心动",
          description: "喜欢、想念、告白",
          keywords: ["喜欢", "想你", "心动", "love"],
          promptFragment: "语气更柔软、更靠近，流露心动。",
          live2dExpression: expr.love,
          priority: 70,
          enabled: true,
        },
        {
          projectId: project.id,
          name: "日常",
          description: "问候、闲聊、陪伴",
          keywords: ["你好", "在吗", "早", "晚安", "hi"],
          promptFragment: "自然地寒暄，保持陪伴感。",
          live2dExpression: expr.daily,
          priority: 50,
          enabled: true,
        },
      ],
    });

    // 6. Fan codes (only if none yet) so the audience chat gate works.
    const existingCodes = await prisma.fanAccessCode.count({
      where: { projectId: project.id, status: "active" },
    });
    if (existingCodes === 0) {
      const codes = await generateFanCodeBatch({
        projectId: project.id,
        creatorId: creator.id,
        quantity: 3,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        maxMessages: 500,
        bindMode: "none",
      });
      console.log(`  ${character.slug}: fan codes ->`, codes.map((c) => c.code).join(", "));
    }

    // 7. Publish.
    await prisma.project.update({
      where: { id: project.id },
      data: { status: "published" },
    });

    console.log(`✓ ${character.name}  /c/${character.slug}`);
  }

  console.log(`\nCreator '${CREATOR_USERNAME}' (password: ${CREATOR_PASSWORD}) now owns ${CHARACTERS.length} published characters.`);
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
