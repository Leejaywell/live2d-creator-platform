import { writeFileSync } from "node:fs";

import { applyScriptEnvToProcess, loadEnvFileForScript } from "../src/lib/env-file";
import { loadQaModelZip } from "../src/lib/qa-model-source";

type ProvisionReport = {
  ok: boolean;
  projectSlug: string;
  creatorEmail: string;
  fanCode: string;
  modelUploaded: boolean;
  envFile?: string;
  warnings: string[];
};

async function main() {
  if (process.argv.includes("--help")) {
    printHelp();
    return;
  }

  const inputEnvFile = valueAfter("--app-env-file") ?? ".env";
  const loadedEnv = loadEnvFileForScript(inputEnvFile);
  applyScriptEnvToProcess(loadedEnv, appEnvKeys());

  const [{ generateFanCodeBatch }, { uploadModelAsset }, { prisma }] = await Promise.all([
    import("../src/lib/fan-code-service"),
    import("../src/lib/model-assets"),
    import("../src/lib/prisma"),
  ]);

  try {
    const creatorEmail = env("QA_CREATOR_EMAIL", "qa-creator@example.test");
    const projectSlug = env("QA_PROJECT_SLUG", "qa-live2d");
    const projectName = env("QA_PROJECT_NAME", "QA Live2D Project");
    const baseUrl = env("QA_BASE_URL", "http://localhost:3000");
    const hasModelSource = Boolean(process.env.QA_MODEL_ZIP_PATH || process.env.QA_MODEL_ZIP_URL);
    const qaEnvFile = valueAfter("--write-env") ?? ".env.qa";
    const warnings: string[] = [];

    const creator = await upsertQaCreator(prisma, creatorEmail);
    const project = await upsertQaProject(prisma, {
      creatorId: creator.id,
      slug: projectSlug,
      name: projectName,
    });

    const modelUploaded = hasModelSource ? await uploadQaModel(uploadModelAsset, { creatorId: creator.id, projectId: project.id }) : false;
    if (!hasModelSource) {
      warnings.push("QA_MODEL_ZIP_PATH or QA_MODEL_ZIP_URL was not provided; browser QA should run with QA_EXPECT_LIVE2D=false unless a valid model already exists.");
    }

    const [code] = await generateFanCodeBatch({
      projectId: project.id,
      creatorId: creator.id,
      quantity: 1,
      expiresAt: new Date(Date.now() + numberEnv("QA_FAN_CODE_EXPIRES_DAYS", 7) * 24 * 60 * 60 * 1000),
      maxMessages: numberEnv("QA_FAN_CODE_MAX_MESSAGES", 20),
      bindMode: "none",
    });

    await prisma.project.update({
      where: { id: project.id },
      data: { status: "published" },
    });

    const qaEnv = [
      `QA_BASE_URL=${quote(baseUrl)}`,
      `QA_PROJECT_SLUG=${quote(projectSlug)}`,
      `QA_FAN_CODE=${quote(code.code)}`,
      `QA_CHAT_MESSAGE=${quote(env("QA_CHAT_MESSAGE", "你好"))}`,
      `QA_EXPECT_LIVE2D=${quote(String(modelUploaded || process.env.QA_EXPECT_LIVE2D === "true"))}`,
      `QA_HEADLESS=${quote(env("QA_HEADLESS", "true"))}`,
    ].join("\n");
    writeFileSync(qaEnvFile, `${qaEnv}\n`);

    const report: ProvisionReport = {
      ok: true,
      projectSlug,
      creatorEmail,
      fanCode: code.code,
      modelUploaded,
      envFile: qaEnvFile,
      warnings,
    };

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function upsertQaCreator(prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"], email: string) {
  return prisma.$transaction(async (tx) => {
    const creator = await tx.user.upsert({
      where: { email },
      update: {
        role: "creator",
        status: "active",
      },
      create: {
        email,
        role: "creator",
        status: "active",
        emailVerified: new Date(),
      },
    });

    await tx.creatorProfile.upsert({
      where: { userId: creator.id },
      update: { displayName: "QA Creator" },
      create: { userId: creator.id, displayName: "QA Creator" },
    });

    await tx.creatorPlan.upsert({
      where: { creatorId: creator.id },
      update: {
        status: "active",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        maxProjects: 10,
        storageLimitMb: 4096,
        monthlyAiMessageLimit: 10000,
        fanCodeQuota: 1000,
      },
      create: {
        creatorId: creator.id,
        planName: "QA Pro",
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        maxProjects: 10,
        storageLimitMb: 4096,
        monthlyAiMessageLimit: 10000,
        fanCodeQuota: 1000,
      },
    });

    return creator;
  });
}

async function upsertQaProject(prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"], input: { creatorId: string; slug: string; name: string }) {
  const project = await prisma.project.upsert({
    where: { slug: input.slug },
    update: {
      creatorId: input.creatorId,
      name: input.name,
      status: "published",
      intro: "Automated post-deploy QA project.",
      systemPrompt: "You are a concise Live2D QA assistant. Reply with short helpful messages and JSON tags when relevant.",
      welcomeMessage: "QA session ready.",
      theme: "#0f766e",
    },
    create: {
      creatorId: input.creatorId,
      name: input.name,
      slug: input.slug,
      intro: "Automated post-deploy QA project.",
      systemPrompt: "You are a concise Live2D QA assistant. Reply with short helpful messages and JSON tags when relevant.",
      welcomeMessage: "QA session ready.",
      theme: "#0f766e",
      status: "published",
    },
  });

  await prisma.triggerTag.upsert({
    where: {
      projectId_name: {
        projectId: project.id,
        name: "脸红",
      },
    },
    update: {
      enabled: true,
      keywords: ["你好", "喜欢", "陪"],
      promptFragment: "Reply warmly and briefly.",
      priority: 100,
    },
    create: {
      projectId: project.id,
      name: "脸红",
      description: "QA trigger tag",
      keywords: ["你好", "喜欢", "陪"],
      promptFragment: "Reply warmly and briefly.",
      live2dExpression: "Param5=1",
      priority: 100,
    },
  });

  return project;
}

async function uploadQaModel(
  uploadModelAsset: typeof import("../src/lib/model-assets")["uploadModelAsset"],
  input: { creatorId: string; projectId: string },
) {
  const modelZip = await loadQaModelZip({
    path: process.env.QA_MODEL_ZIP_PATH,
    url: process.env.QA_MODEL_ZIP_URL,
    sha256: process.env.QA_MODEL_ZIP_SHA256,
    allowInsecureUrl: process.env.QA_MODEL_ZIP_ALLOW_INSECURE_URL === "true",
  });
  if (!modelZip) return false;

  const model = await uploadModelAsset({
    projectId: input.projectId,
    creatorId: input.creatorId,
    fileName: modelZip.fileName,
    data: modelZip.data,
  });

  return model.validationStatus === "valid";
}

function env(name: string, fallback: string) {
  return process.env[name] || fallback;
}

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function valueAfter(flag: string) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function appEnvKeys() {
  return Object.keys(loadEnvFileForScript(".env.example").env);
}

function quote(value: string) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function printHelp() {
  console.log(`Provision post-deploy browser QA data.

Usage:
  npm run qa:provision -- --app-env-file .env.production --write-env .env.qa

Environment:
  QA_BASE_URL                 Public app URL for generated .env.qa
  QA_CREATOR_EMAIL            Creator email to upsert
  QA_PROJECT_SLUG             Project slug to upsert
  QA_PROJECT_NAME             Project display name
  QA_MODEL_ZIP_PATH           Optional real Live2D zip to upload
  QA_MODEL_ZIP_URL            Optional HTTPS Live2D zip URL to download and upload
  QA_MODEL_ZIP_SHA256         Optional expected SHA-256 for path or URL model zip
  QA_FAN_CODE_EXPIRES_DAYS    Defaults to 7
  QA_FAN_CODE_MAX_MESSAGES    Defaults to 20
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
