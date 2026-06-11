import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { resolveSeedConfig } from "../src/lib/seed-config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const { superAdminEmail: adminEmail, creatorEmail } = resolveSeedConfig();

  const superAdmin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: "super_admin",
      status: "active",
    },
    create: {
      email: adminEmail,
      role: "super_admin",
      status: "active",
      emailVerified: new Date(),
    },
  });

  const creator = await prisma.user.upsert({
    where: { email: creatorEmail },
    update: {
      role: "creator",
      status: "active",
    },
    create: {
      email: creatorEmail,
      role: "creator",
      status: "active",
      emailVerified: new Date(),
      creatorProfile: {
        create: {
          displayName: "尤里 Urzis",
          bio: "Live2D AI companion demo creator",
        },
      },
      creatorPlan: {
        create: {
          planName: "Seed Pro",
          tier: "paid",
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          maxProjects: 3,
          storageLimitMb: 1024,
          monthlyAiMessageLimit: 5000,
          fanCodeQuota: 100,
        },
      },
    },
  });

  await prisma.creatorProfile.upsert({
    where: { userId: creator.id },
    update: {
      displayName: "尤里 Urzis",
      bio: "Live2D AI companion demo creator",
    },
    create: {
      userId: creator.id,
      displayName: "尤里 Urzis",
      bio: "Live2D AI companion demo creator",
    },
  });

  await prisma.creatorPlan.upsert({
    where: { creatorId: creator.id },
    update: {
      status: "active",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    create: {
      creatorId: creator.id,
      planName: "Seed Pro",
      tier: "paid",
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      maxProjects: 3,
      storageLimitMb: 1024,
      monthlyAiMessageLimit: 5000,
      fanCodeQuota: 100,
    },
  });

  const project = await prisma.project.upsert({
    where: { slug: "urzis" },
    update: {
      status: "published",
    },
    create: {
      creatorId: creator.id,
      name: "尤里 Urzis",
      slug: "urzis",
      intro: "温柔但有掌控感的 Live2D AI 伴侣。",
      systemPrompt: "你是尤里 Urzis，一位温柔但有掌控感的 Live2D 桌面伴侣。回复要短，保持陪伴感。",
      welcomeMessage: "宝宝，我会一直陪着你的。",
      theme: "#0f766e",
      status: "published",
    },
  });

  await prisma.triggerTag.createMany({
    data: [
      {
        projectId: project.id,
        name: "脸红",
        description: "亲密、害羞、陪伴感",
        keywords: ["想你", "喜欢", "陪"],
        promptFragment: "回复更轻、更近，表达陪伴。",
        live2dExpression: "Param5=1",
        priority: 80,
      },
      {
        projectId: project.id,
        name: "哭哭",
        description: "安慰、疲惫、压力",
        keywords: ["难过", "累", "压力"],
        promptFragment: "先安抚，再给出很短的行动建议。",
        live2dExpression: "Param3=1",
        priority: 70,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: superAdmin.id,
      actorRole: "super_admin",
      action: "seed.initialized",
      targetType: "Project",
      targetId: project.id,
      after: {
        adminEmail,
        creatorEmail,
        projectSlug: project.slug,
      },
    },
  });

  console.log(`Seeded super admin ${adminEmail}, creator ${creatorEmail}, project ${project.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
