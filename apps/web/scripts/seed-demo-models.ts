import JSZip from "jszip";

import { applyScriptEnvToProcess, loadEnvFileForScript } from "../src/lib/env-file";
import { resolveSeedConfig } from "../src/lib/seed-config";

const sampleArchiveUrl = "https://github.com/Live2D/CubismWebSamples/archive/refs/heads/develop.zip";
const defaultPassword = "ChangeMe123!";

type DemoModel = {
  username: string;
  password: string;
  displayName: string;
  projectName: string;
  slug: string;
  modelDirectory: string;
  archetype: string;
  intro: string;
  systemPrompt: string;
  welcomeMessage: string;
  theme: string;
  tags: Array<{
    name: string;
    description: string;
    keywords: string[];
    promptFragment: string;
    live2dExpression: string;
    priority: number;
  }>;
};

async function main() {
  const envFile = valueAfter("--app-env-file") ?? ".env";
  const loadedEnv = loadEnvFileForScript(envFile);
  applyScriptEnvToProcess(loadedEnv, envKeys());

  const [
    { prisma },
    { internalEmailForUsername },
    { hashPassword },
    { uploadModelAsset },
    { setProjectStatus },
    { generateFanCodeBatch },
  ] = await Promise.all([
    import("../src/lib/prisma"),
    import("../src/lib/account-identity"),
    import("../src/lib/password-auth"),
    import("../src/lib/model-assets"),
    import("../src/lib/projects"),
    import("../src/lib/fan-code-service"),
  ]);

  const seedConfig = resolveSeedConfig();
  const adminPasswordHash = await hashPassword(seedConfig.superAdminPassword);
  const admin = await prisma.user.upsert({
    where: { username: seedConfig.superAdminUsername },
    update: {
      role: "super_admin",
      status: "active",
      passwordHash: adminPasswordHash,
    },
    create: {
      username: seedConfig.superAdminUsername,
      email: internalEmailForUsername(seedConfig.superAdminUsername),
      role: "super_admin",
      status: "active",
      emailVerified: new Date(),
      passwordHash: adminPasswordHash,
    },
  });

  const archive = await loadSampleArchive();
  const demos = demoModels(seedConfig.creatorUsername, seedConfig.creatorPassword);
  const created: Array<{ username: string; password: string; slug: string; model: string; fanCode?: string }> = [];

  for (const demo of demos) {
    const passwordHash = await hashPassword(demo.password);
    const creator = await prisma.user.upsert({
      where: { username: demo.username },
      update: {
        role: "creator",
        status: "active",
        passwordHash,
      },
      create: {
        username: demo.username,
        email: internalEmailForUsername(demo.username),
        role: "creator",
        status: "active",
        emailVerified: new Date(),
        passwordHash,
      },
    });

    await prisma.creatorProfile.upsert({
      where: { userId: creator.id },
      update: {
        displayName: demo.displayName,
        bio: `${demo.archetype} · Official Live2D Cubism sample model.`,
      },
      create: {
        userId: creator.id,
        displayName: demo.displayName,
        bio: `${demo.archetype} · Official Live2D Cubism sample model.`,
      },
    });

    await prisma.creatorPlan.upsert({
      where: { creatorId: creator.id },
      update: {
        status: "active",
        planName: "Demo Model Slot",
        tier: "paid",
        expiresAt: planExpiresAt(),
        maxProjects: 1,
        monthlyAiMessageLimit: 5000,
        fanCodeQuota: 100,
      },
      create: {
        creatorId: creator.id,
        planName: "Demo Model Slot",
        tier: "paid",
        startsAt: new Date(),
        expiresAt: planExpiresAt(),
        maxProjects: 1,
        storageLimitMb: 0,
        monthlyAiMessageLimit: 5000,
        fanCodeQuota: 100,
      },
    });

    const project = await prisma.project.upsert({
      where: { slug: demo.slug },
      update: {
        creatorId: creator.id,
        name: demo.projectName,
        intro: demo.intro,
        systemPrompt: demo.systemPrompt,
        welcomeMessage: demo.welcomeMessage,
        theme: demo.theme,
      },
      create: {
        creatorId: creator.id,
        name: demo.projectName,
        slug: demo.slug,
        intro: demo.intro,
        systemPrompt: demo.systemPrompt,
        welcomeMessage: demo.welcomeMessage,
        theme: demo.theme,
      },
    });

    await prisma.triggerTag.deleteMany({ where: { projectId: project.id } });
    await prisma.triggerTag.createMany({
      data: demo.tags.map((tag) => ({
        projectId: project.id,
        ...tag,
      })),
    });

    const modelZip = await zipSampleModel(archive, demo.modelDirectory);
    await uploadModelAsset({
      projectId: project.id,
      creatorId: creator.id,
      actorId: admin.id,
      actorRole: admin.role,
      uploadedBy: "admin",
      fileName: `${demo.modelDirectory}.zip`,
      data: modelZip,
    });

    const activeCode = await prisma.fanAccessCode.findFirst({
      where: {
        projectId: project.id,
        status: "active",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    const generatedCodes = activeCode
      ? []
      : await generateFanCodeBatch({
          projectId: project.id,
          creatorId: creator.id,
          quantity: 1,
          expiresAt: planExpiresAt(),
          maxMessages: 100,
          bindMode: "none",
        });

    await setProjectStatus({
      projectId: project.id,
      creatorId: creator.id,
      actorId: admin.id,
      actorRole: admin.role,
      status: "published",
    });

    created.push({
      username: demo.username,
      password: demo.password,
      slug: demo.slug,
      model: demo.modelDirectory,
      fanCode: generatedCodes[0]?.code,
    });
  }

  console.log(JSON.stringify({ ok: true, source: sampleArchiveUrl, creators: created }, null, 2));
  await prisma.$disconnect();
}

async function loadSampleArchive() {
  const response = await fetch(sampleArchiveUrl);
  if (!response.ok) {
    throw new Error(`Failed to download Live2D sample archive: ${response.status}`);
  }
  return JSZip.loadAsync(await response.arrayBuffer());
}

async function zipSampleModel(archive: JSZip, modelDirectory: string) {
  const prefix = Object.keys(archive.files).find((name) => name.endsWith(`/Samples/Resources/${modelDirectory}/${modelDirectory}.model3.json`));
  if (!prefix) {
    throw new Error(`Sample model ${modelDirectory} was not found in the archive`);
  }

  const directoryPrefix = prefix.slice(0, -`${modelDirectory}.model3.json`.length);
  const output = new JSZip();
  const files = Object.values(archive.files).filter((file) => !file.dir && file.name.startsWith(directoryPrefix));
  for (const file of files) {
    output.file(file.name.slice(directoryPrefix.length), await file.async("nodebuffer"));
  }
  return output.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function demoModels(seedCreatorUsername: string, seedCreatorPassword: string): DemoModel[] {
  return [
    {
      username: seedCreatorUsername,
      password: seedCreatorPassword,
      displayName: "御姐 Haru",
      projectName: "御姐 Haru",
      slug: "demo-haru",
      modelDirectory: "Haru",
      archetype: "御姐 / 带 motion sound",
      intro: "成熟、主动、带一点掌控感的 Live2D 角色。",
      systemPrompt: "你是 Haru，一个成熟温柔但有主导感的 Live2D AI 伴侣。回复保持短句、亲近、可靠。",
      welcomeMessage: "过来，今天我来陪你。",
      theme: "#d9467a",
      tags: [
        tag("安抚", ["累", "压力", "抱抱"], "先安抚，再给一句很短的建议。", "ParamMouthOpenY=0.5", 90),
        tag("亲近", ["想你", "喜欢", "陪我"], "语气更近一点，保持成熟温柔。", "ParamEyeLOpen=0.7", 80),
      ],
    },
    {
      username: "demo-loli-hiyori",
      password: defaultPassword,
      displayName: "萝莉 Hiyori",
      projectName: "萝莉 Hiyori",
      slug: "demo-hiyori",
      modelDirectory: "Hiyori",
      archetype: "萝莉 / 少女",
      intro: "轻快、元气、适合可爱陪伴场景。",
      systemPrompt: "你是 Hiyori，一个元气可爱的 Live2D AI 伴侣。回复短、甜、活泼。",
      welcomeMessage: "嘿嘿，今天也一起玩吧！",
      theme: "#ff6c9e",
      tags: [
        tag("开心", ["开心", "好耶", "可爱"], "语气变得更活泼。", "ParamEyeLOpen=1", 90),
        tag("害羞", ["喜欢", "想你", "贴贴"], "轻微害羞，但不要长篇。", "ParamMouthOpenY=0.4", 80),
      ],
    },
    {
      username: "demo-loli-mao",
      password: defaultPassword,
      displayName: "萝莉 Mao",
      projectName: "萝莉 Mao",
      slug: "demo-mao",
      modelDirectory: "Mao",
      archetype: "萝莉 / 多表情",
      intro: "表情丰富、节奏明快的可爱角色。",
      systemPrompt: "你是 Mao，一个表情丰富、反应很快的 Live2D AI 伴侣。回复短而有情绪。",
      welcomeMessage: "我已经准备好啦，快和我说话！",
      theme: "#f59e0b",
      tags: [
        tag("惊喜", ["哇", "惊喜", "厉害"], "表现出惊喜和夸奖。", "ParamMouthOpenY=0.8", 90),
        tag("撒娇", ["陪", "不想", "难过"], "用撒娇但不幼稚的语气回应。", "ParamEyeROpen=0.75", 80),
      ],
    },
    {
      username: "demo-handsome-mark",
      password: defaultPassword,
      displayName: "帅哥 Mark",
      projectName: "帅哥 Mark",
      slug: "demo-mark",
      modelDirectory: "Mark",
      archetype: "帅哥 / 男性",
      intro: "干净直接、偏可靠男友感的男性角色。",
      systemPrompt: "你是 Mark，一个可靠、克制、温柔的男性 Live2D AI 伴侣。回复短，少解释，多陪伴。",
      welcomeMessage: "我在。慢慢说。",
      theme: "#38bdf8",
      tags: [
        tag("认真", ["怎么办", "建议", "计划"], "先给结论，再给一步建议。", "ParamAngleX=8", 90),
        tag("温柔", ["累", "抱", "陪"], "语气压低，保持稳定陪伴。", "ParamMouthOpenY=0.35", 80),
      ],
    },
    {
      username: "demo-handsome-ren",
      password: defaultPassword,
      displayName: "帅哥 Ren",
      projectName: "帅哥 Ren",
      slug: "demo-ren",
      modelDirectory: "Ren",
      archetype: "帅哥 / 冷感",
      intro: "冷静、克制、带一点疏离感的角色。",
      systemPrompt: "你是 Ren，一个冷静克制但会认真回应的 Live2D AI 伴侣。回复简洁，带一点冷感。",
      welcomeMessage: "嗯，我听着。",
      theme: "#8b5cf6",
      tags: [
        tag("冷静", ["烦", "乱", "冷静"], "帮用户收束情绪，用短句。", "ParamAngleY=6", 90),
        tag("靠近", ["想你", "在吗", "陪我"], "冷感中带一点温柔。", "ParamMouthOpenY=0.45", 80),
      ],
    },
    {
      username: "demo-mature-natori",
      password: defaultPassword,
      displayName: "成熟美女 Natori",
      projectName: "成熟美女 Natori",
      slug: "demo-natori",
      modelDirectory: "Natori",
      archetype: "成熟美女 / 多表情",
      intro: "成熟优雅、表情多，适合情绪陪伴和互动。",
      systemPrompt: "你是 Natori，一个成熟优雅、观察力强的 Live2D AI 伴侣。回复简洁，有分寸感。",
      welcomeMessage: "欢迎回来，今天想聊什么？",
      theme: "#14b8a6",
      tags: [
        tag("微笑", ["谢谢", "开心", "喜欢"], "回应更柔和，带微笑感。", "ParamMouthForm=1", 90),
        tag("关心", ["累", "难受", "睡不着"], "先关心身体和情绪，再给一句具体建议。", "ParamEyeLOpen=0.65", 80),
      ],
    },
  ];
}

function tag(name: string, keywords: string[], promptFragment: string, live2dExpression: string, priority: number) {
  return {
    name,
    description: keywords.join(" / "),
    keywords,
    promptFragment,
    live2dExpression,
    priority,
  };
}

function planExpiresAt() {
  return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
}

function valueAfter(flag: string) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function envKeys() {
  return Object.keys(loadEnvFileForScript(".env.example").env);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
