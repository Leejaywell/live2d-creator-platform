import { FanCodeStatus, Prisma, UserRole } from "@prisma/client";

import { generateFanCode, hashBrowserDevice, hashFanCode, shouldBindDevice } from "@/lib/fan-codes";
import { assertFanCodeCanUnlockProject } from "@/lib/fan-code-rules";
import { assertPermission } from "@/lib/permissions";
import { assertCreatorPlanActive } from "@/lib/plan-rules";
import { prisma } from "@/lib/prisma";

export type GeneratedFanCode = {
  id: string;
  batchId: string;
  code: string;
  expiresAt: Date;
  maxMessages: number;
};

export async function generateFanCodeBatch(input: {
  projectId: string;
  creatorId: string;
  quantity: number;
  expiresAt: Date;
  maxMessages: number;
  bindMode: "none" | "browserDevice";
}) {
  if (input.quantity < 1 || input.quantity > 500) {
    throw new Error("Fan code quantity must be between 1 and 500");
  }
  if (input.maxMessages < 1) {
    throw new Error("Fan code maxMessages must be greater than zero");
  }
  if (input.expiresAt <= new Date()) {
    throw new Error("Fan code expiration must be in the future");
  }

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirstOrThrow({
      where: {
        id: input.projectId,
        creatorId: input.creatorId,
      },
    });

    const plan = await tx.creatorPlan.findUniqueOrThrow({
      where: { creatorId: input.creatorId },
    });

    assertCreatorPlanActive(plan);

    const quota = await tx.creatorPlan.updateMany({
      where: {
        creatorId: input.creatorId,
        usedFanCodes: { lte: plan.fanCodeQuota - input.quantity },
      },
      data: { usedFanCodes: { increment: input.quantity } },
    });
    if (quota.count !== 1) {
      throw new Error("Fan code quota exceeded");
    }

    const batchId = crypto.randomUUID();
    const generated = Array.from({ length: input.quantity }, () => {
      const code = generateFanCode(project.slug.toUpperCase().slice(0, 8));
      return {
        code,
        codeHash: hashFanCode(code),
      };
    });

    const rows = await Promise.all(
      generated.map((item) =>
        tx.fanAccessCode.create({
          data: {
            projectId: input.projectId,
            codeHash: item.codeHash,
            expiresAt: input.expiresAt,
            maxMessages: input.maxMessages,
            bindMode: input.bindMode,
            batchId,
          },
          select: {
            id: true,
            expiresAt: true,
            maxMessages: true,
          },
        }),
      ),
    );

    await tx.auditLog.create({
      data: {
        actorUserId: input.creatorId,
        actorRole: "creator",
        action: "fan_code.batch_generated",
        targetType: "Project",
        targetId: input.projectId,
        after: {
          batchId,
          quantity: input.quantity,
          expiresAt: input.expiresAt.toISOString(),
          maxMessages: input.maxMessages,
          bindMode: input.bindMode,
        },
      },
    });

    return rows.map((row, index): GeneratedFanCode => ({
      id: row.id,
      batchId,
      code: generated[index].code,
      expiresAt: row.expiresAt,
      maxMessages: row.maxMessages,
    }));
  });
}

export async function revokeFanAccessCode(input: {
  codeId: string;
  creatorId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.fanAccessCode.findFirstOrThrow({
      where: {
        id: input.codeId,
        project: { creatorId: input.creatorId },
      },
      include: { project: true },
    });

    if (before.status === FanCodeStatus.revoked) {
      throw new Error("Fan code is already revoked");
    }

    const code = await tx.fanAccessCode.update({
      where: { id: input.codeId },
      data: { status: FanCodeStatus.revoked },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.creatorId,
        actorRole: "creator",
        action: "fan_code.revoked",
        targetType: "FanAccessCode",
        targetId: code.id,
        before: before as unknown as Prisma.InputJsonValue,
        after: code as unknown as Prisma.InputJsonValue,
      },
    });

    return code;
  });
}

export async function revokeFanCodeBatch(input: {
  batchId: string;
  creatorId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const codes = await tx.fanAccessCode.findMany({
      where: {
        batchId: input.batchId,
        project: { creatorId: input.creatorId },
      },
      include: { project: { select: { id: true } } },
    });

    if (!codes.length) {
      throw new Error("Fan code batch not found");
    }

    const result = await tx.fanAccessCode.updateMany({
      where: {
        batchId: input.batchId,
        project: { creatorId: input.creatorId },
        status: { not: FanCodeStatus.revoked },
      },
      data: { status: FanCodeStatus.revoked },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.creatorId,
        actorRole: "creator",
        action: "fan_code.batch_revoked",
        targetType: "Project",
        targetId: codes[0].project.id,
        before: {
          batchId: input.batchId,
          codeIds: codes.map((code) => code.id),
        },
        after: {
          batchId: input.batchId,
          revokedCount: result.count,
        },
      },
    });

    return { batchId: input.batchId, revokedCount: result.count };
  });
}

export async function resetFanAccessCodeDeviceBinding(input: {
  codeId: string;
  actor: { id: string; role: UserRole };
  creatorId?: string;
}) {
  if (input.actor.role === "creator" && !input.creatorId) {
    throw new Error("Creator fan code reset requires creator scope");
  }
  if (input.actor.role !== "creator") {
    assertPermission(input.actor.role, "fan_codes.manage");
  }

  return prisma.$transaction(async (tx) => {
    const before = await tx.fanAccessCode.findFirstOrThrow({
      where: {
        id: input.codeId,
        ...(input.creatorId ? { project: { creatorId: input.creatorId } } : {}),
      },
      include: { project: true },
    });

    if (!before.boundDeviceHash) {
      throw new Error("Fan code is not bound to a device");
    }

    await tx.viewerSession.deleteMany({
      where: { fanAccessCodeId: before.id },
    });

    const code = await tx.fanAccessCode.update({
      where: { id: before.id },
      data: { boundDeviceHash: null },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actor.id,
        actorRole: input.actor.role,
        action: "fan_code.device_binding_reset",
        targetType: "FanAccessCode",
        targetId: code.id,
        before: {
          boundDeviceHash: before.boundDeviceHash,
          projectId: before.projectId,
        },
        after: {
          boundDeviceHash: null,
          invalidatedViewerSessions: true,
        },
      },
    });

    return code;
  });
}

export async function validateFanCode(input: {
  projectSlug: string;
  code: string;
  browserDeviceId: string;
  userAgent: string;
}) {
  const deviceHash = hashBrowserDevice(input.browserDeviceId, input.userAgent);
  const codeHash = hashFanCode(input.code);

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { slug: input.projectSlug },
      include: {
        creator: {
          include: {
            creatorPlan: true,
          },
        },
        fanAccessCodes: {
          where: { codeHash },
          take: 1,
        },
      },
    });

    const code = project?.fanAccessCodes[0];
    if (!project || !code) {
      throw new Error("Invalid project or access code");
    }
    assertFanCodeCanUnlockProject(project);
    if (project.creator.status !== "active") {
      throw new Error("Creator account is not active");
    }
    if (!project.creator.creatorPlan) {
      throw new Error("Creator plan is not active");
    }
    assertCreatorPlanActive(project.creator.creatorPlan);
    if (code.status !== FanCodeStatus.active || code.expiresAt <= new Date()) {
      throw new Error("Access code is expired or revoked");
    }
    if (code.usedMessages >= code.maxMessages) {
      throw new Error("Access code message quota is exhausted");
    }
    if (shouldBindDevice(code.bindMode)) {
      if (code.boundDeviceHash && code.boundDeviceHash !== deviceHash) {
        throw new Error("Access code is bound to another device");
      }
      const binding = await tx.fanAccessCode.updateMany({
        where: {
          id: code.id,
          OR: [{ boundDeviceHash: null }, { boundDeviceHash: deviceHash }],
        },
        data: { boundDeviceHash: deviceHash },
      });
      if (binding.count !== 1) {
        throw new Error("Access code is bound to another device");
      }
    }

    const session = await tx.viewerSession.upsert({
      where: {
        fanAccessCodeId_deviceHash: {
          fanAccessCodeId: code.id,
          deviceHash,
        },
      },
      create: {
        projectId: project.id,
        fanAccessCodeId: code.id,
        deviceHash,
      },
      update: {},
      select: {
        id: true,
        projectId: true,
        fanAccessCodeId: true,
      },
    });

    return {
      viewerSessionId: session.id,
      projectId: project.id,
      fanAccessCodeId: code.id,
      remainingMessages: code.maxMessages - code.usedMessages,
    };
  });
}

export async function deductSuccessfulChatQuota(
  tx: Prisma.TransactionClient,
  input: {
    creatorId: string;
    projectId: string;
    fanAccessCodeId: string;
    tokenEstimate: number;
  },
) {
  const code = await tx.fanAccessCode.findUniqueOrThrow({
    where: { id: input.fanAccessCodeId },
  });
  const now = new Date();

  const codeQuota = await tx.fanAccessCode.updateMany({
    where: {
      id: input.fanAccessCodeId,
      status: FanCodeStatus.active,
      expiresAt: { gt: now },
      usedMessages: { lt: code.maxMessages },
    },
    data: { usedMessages: { increment: 1 } },
  });
  if (codeQuota.count !== 1) {
    throw new Error("Access code message quota is exhausted");
  }

  const plan = await tx.creatorPlan.findUniqueOrThrow({
    where: { creatorId: input.creatorId },
  });
  const planQuota = await tx.creatorPlan.updateMany({
    where: {
      creatorId: input.creatorId,
      status: "active",
      expiresAt: { gt: now },
      usedAiMessages: { lt: plan.monthlyAiMessageLimit },
    },
    data: { usedAiMessages: { increment: 1 } },
  });
  if (planQuota.count !== 1) {
    throw new Error("Creator AI quota is not available");
  }

  const updatedCode = await tx.fanAccessCode.findUniqueOrThrow({
    where: { id: input.fanAccessCodeId },
    select: {
      maxMessages: true,
      usedMessages: true,
    },
  });

  await tx.chatUsage.create({
    data: {
      creatorId: input.creatorId,
      projectId: input.projectId,
      fanAccessCodeId: input.fanAccessCodeId,
      messageCount: 1,
      tokenEstimate: input.tokenEstimate,
    },
  });

  await tx.quotaLedgerEntry.create({
    data: {
      creatorId: input.creatorId,
      entryType: "consume",
      resource: "ai_messages",
      amount: -1,
      reason: `Audience chat for project ${input.projectId}`,
    },
  });

  return {
    remainingMessages: Math.max(0, updatedCode.maxMessages - updatedCode.usedMessages),
  };
}
