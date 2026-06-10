import { OrderType, PaymentMethod, Prisma, QuotaResource, UserRole, UserStatus, VoiceCloneStatus } from "@prisma/client";

import { assertManualOrderAllowedForCheckout } from "@/lib/checkout-modes";
import { assertPermission } from "@/lib/permissions";
import { assertFuturePlanExpiration, defaultPlanExpiresAt, resolveManualOrderPlanPeriod } from "@/lib/plan-periods";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { normalizeWechatOpenId } from "@/lib/wechat-auth";

export async function upsertAdminUser(input: {
  admin: { id: string; role: UserRole };
  email: string;
  role: Exclude<UserRole, "creator">;
  status: UserStatus;
}) {
  assertPermission(input.admin.role, "admin.users.manage");
  const email = normalizeEmail(input.email);

  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { email },
    });

    if (before?.id === input.admin.id && (input.role !== "super_admin" || input.status !== "active")) {
      throw new Error("Super admins cannot demote or suspend their own account");
    }

    const user = await tx.user.upsert({
      where: { email },
      update: {
        role: input.role,
        status: input.status,
      },
      create: {
        email,
        role: input.role,
        status: input.status,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.admin.id,
        actorRole: input.admin.role,
        action: "admin_user.upserted",
        targetType: "User",
        targetId: user.id,
        before: before as unknown as Prisma.InputJsonValue,
        after: user as unknown as Prisma.InputJsonValue,
      },
    });

    return user;
  });
}

export async function createCreatorAccount(input: {
  admin: { id: string; role: UserRole };
  email: string;
  displayName: string;
  planName?: string;
  expiresAt?: Date;
  maxProjects?: number;
  storageLimitMb?: number;
  monthlyAiMessageLimit?: number;
  fanCodeQuota?: number;
}) {
  assertPermission(input.admin.role, "creators.manage");
  const email = normalizeEmail(input.email);

  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email },
      select: { role: true },
    });
    if (existingUser && existingUser.role !== "creator") {
      throw new Error("Creator accounts cannot replace admin accounts");
    }

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
      },
    });

    await tx.creatorProfile.upsert({
      where: { userId: creator.id },
      update: {
        displayName: input.displayName,
      },
      create: {
        userId: creator.id,
        displayName: input.displayName,
      },
    });

    if (input.planName) {
      const planExpiresAt = input.expiresAt ?? defaultPlanExpiresAt();
      assertFuturePlanExpiration(planExpiresAt);

      await tx.creatorPlan.upsert({
        where: { creatorId: creator.id },
        update: {
          planName: input.planName,
          expiresAt: planExpiresAt,
          maxProjects: input.maxProjects,
          storageLimitMb: input.storageLimitMb,
          monthlyAiMessageLimit: input.monthlyAiMessageLimit,
          fanCodeQuota: input.fanCodeQuota,
          status: "active",
        },
        create: {
          creatorId: creator.id,
          planName: input.planName,
          startsAt: new Date(),
          expiresAt: planExpiresAt,
          maxProjects: input.maxProjects ?? 1,
          storageLimitMb: input.storageLimitMb ?? 512,
          monthlyAiMessageLimit: input.monthlyAiMessageLimit ?? 1000,
          fanCodeQuota: input.fanCodeQuota ?? 20,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: input.admin.id,
        actorRole: input.admin.role,
        action: "creator_account.upserted",
        targetType: "User",
        targetId: creator.id,
        after: {
          email,
          displayName: input.displayName,
          planName: input.planName,
          maxProjects: input.maxProjects,
          storageLimitMb: input.storageLimitMb,
          monthlyAiMessageLimit: input.monthlyAiMessageLimit,
          fanCodeQuota: input.fanCodeQuota,
        },
      },
    });

    return creator;
  });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function updateCreatorStatus(input: {
  admin: { id: string; role: UserRole };
  creatorId: string;
  status: UserStatus;
}) {
  assertPermission(input.admin.role, "creators.manage");

  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUniqueOrThrow({
      where: { id: input.creatorId },
    });
    if (before.role !== "creator") {
      throw new Error("Only creator accounts can be updated with this action");
    }

    const creator = await tx.user.update({
      where: { id: input.creatorId },
      data: { status: input.status },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.admin.id,
        actorRole: input.admin.role,
        action: "creator.status_updated",
        targetType: "User",
        targetId: creator.id,
        before: before as unknown as Prisma.InputJsonValue,
        after: creator as unknown as Prisma.InputJsonValue,
      },
    });

    return creator;
  });
}

export async function updateUserWechatBinding(input: {
  admin: { id: string; role: UserRole };
  userId: string;
  openId?: string;
}) {
  const normalizedOpenId = input.openId?.trim() ? normalizeWechatOpenId(input.openId) : null;

  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      include: { accounts: { where: { provider: "wechat" } } },
    });

    if (before.role === "creator") {
      assertPermission(input.admin.role, "creators.manage");
    } else {
      assertPermission(input.admin.role, "admin.users.manage");
    }

    if (normalizedOpenId) {
      const existing = await tx.user.findFirst({
        where: {
          id: { not: before.id },
          OR: [
            { wechatOpenId: normalizedOpenId },
            { accounts: { some: { provider: "wechat", providerAccountId: normalizedOpenId } } },
          ],
        },
        select: { id: true },
      });
      if (existing) {
        throw new Error("WeChat OpenID is already linked to another account");
      }
    }

    await tx.account.deleteMany({
      where: {
        userId: before.id,
        provider: "wechat",
      },
    });

    const user = await tx.user.update({
      where: { id: before.id },
      data: { wechatOpenId: normalizedOpenId },
    });

    if (normalizedOpenId) {
      await tx.account.create({
        data: {
          userId: before.id,
          type: "oauth",
          provider: "wechat",
          providerAccountId: normalizedOpenId,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: input.admin.id,
        actorRole: input.admin.role,
        action: normalizedOpenId ? "user.wechat_linked" : "user.wechat_unlinked",
        targetType: "User",
        targetId: user.id,
        before: {
          wechatOpenId: before.wechatOpenId,
          accounts: before.accounts.map((account) => account.providerAccountId),
        },
        after: { wechatOpenId: user.wechatOpenId },
      },
    });

    return user;
  });
}

export async function createManualOrder(input: {
  admin: { id: string; role: UserRole };
  creatorId: string;
  orderType?: OrderType;
  amount: string;
  paymentMethod: PaymentMethod;
  planName?: string;
  periodStart?: Date;
  periodEnd?: Date;
  projectQuotaDelta?: number;
  aiMessageQuotaDelta?: number;
  storageQuotaDeltaMb?: number;
  fanCodeQuotaDelta?: number;
  notes?: string;
}) {
  assertPermission(input.admin.role, "plans.manage");
  const settings = await getPlatformRuntimeSettings();
  assertManualOrderAllowedForCheckout(settings.checkoutMode, input);
  resolveManualOrderPlanPeriod({ periodStart: input.periodStart, periodEnd: input.periodEnd });
  assertManualOrderHasBusinessImpact(input);

  return prisma.$transaction(async (tx) => {
    const amount = parseManualOrderAmount(input.amount);
    const creator = await tx.user.findUniqueOrThrow({
      where: { id: input.creatorId },
      select: { role: true },
    });
    if (creator.role !== "creator") {
      throw new Error("Manual orders can only target creator accounts");
    }

    const order = await tx.manualOrder.create({
      data: {
        creatorId: input.creatorId,
        orderType: input.orderType ?? (input.planName ? "plan" : "quota_adjustment"),
        amount,
        paymentMethod: input.paymentMethod,
        planName: input.planName,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        projectQuotaDelta: input.projectQuotaDelta ?? 0,
        aiMessageQuotaDelta: input.aiMessageQuotaDelta ?? 0,
        storageQuotaDeltaMb: input.storageQuotaDeltaMb ?? 0,
        fanCodeQuotaDelta: input.fanCodeQuotaDelta ?? 0,
        notes: input.notes,
        createdByAdminId: input.admin.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.admin.id,
        actorRole: input.admin.role,
        action: "manual_order.created",
        targetType: "ManualOrder",
        targetId: order.id,
        after: order as unknown as Prisma.InputJsonValue,
      },
    });

    return order;
  });
}

function assertManualOrderHasBusinessImpact(input: {
  planName?: string;
  projectQuotaDelta?: number;
  aiMessageQuotaDelta?: number;
  storageQuotaDeltaMb?: number;
  fanCodeQuotaDelta?: number;
}) {
  const hasQuotaDelta = [input.projectQuotaDelta, input.aiMessageQuotaDelta, input.storageQuotaDeltaMb, input.fanCodeQuotaDelta].some(
    (amount) => (amount ?? 0) !== 0,
  );
  if (!input.planName && !hasQuotaDelta) {
    throw new Error("Manual order must include a plan or quota change");
  }
}

function parseManualOrderAmount(value: string) {
  const normalized = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Manual order amount must be a positive amount with up to two decimal places");
  }

  const amount = new Prisma.Decimal(normalized);
  if (amount.lte(0)) {
    throw new Error("Manual order amount must be positive");
  }
  return amount;
}

export async function createSupportNote(input: {
  admin: { id: string; role: UserRole };
  targetType: string;
  targetId?: string;
  note: string;
}) {
  assertPermission(input.admin.role, "support.notes");

  return prisma.$transaction(async (tx) => {
    await assertSupportNoteTarget(tx, input.targetType, input.targetId);

    return tx.auditLog.create({
      data: {
        actorUserId: input.admin.id,
        actorRole: input.admin.role,
        action: "support_note.created",
        targetType: input.targetType,
        targetId: input.targetId || undefined,
        after: {
          note: input.note,
        },
      },
    });
  });
}

async function assertSupportNoteTarget(tx: Prisma.TransactionClient, targetType: string, targetId?: string) {
  if (targetType === "General") {
    if (targetId) {
      throw new Error("General support notes cannot have a target id");
    }
    return;
  }

  if (!targetId) {
    throw new Error("Support note target id is required");
  }

  const count = await supportNoteTargetCount(tx, targetType, targetId);
  if (count !== 1) {
    throw new Error("Support note target not found");
  }
}

function supportNoteTargetCount(tx: Prisma.TransactionClient, targetType: string, targetId: string) {
  switch (targetType) {
    case "User":
      return tx.user.count({ where: { id: targetId } });
    case "Project":
      return tx.project.count({ where: { id: targetId } });
    case "FanAccessCode":
      return tx.fanAccessCode.count({ where: { id: targetId } });
    case "ManualOrder":
      return tx.manualOrder.count({ where: { id: targetId } });
    case "VoiceCloneRequest":
      return tx.voiceCloneRequest.count({ where: { id: targetId } });
    default:
      throw new Error("Unsupported support note target type");
  }
}

export async function grantCreatorQuota(input: {
  admin: { id: string; role: UserRole };
  creatorId: string;
  resource: QuotaResource;
  amount: number;
  reason?: string;
}) {
  assertPermission(input.admin.role, "quota.grant");
  if (input.amount <= 0) {
    throw new Error("Quota grant amount must be positive");
  }

  return prisma.$transaction(async (tx) => {
    const creator = await tx.user.findUniqueOrThrow({
      where: { id: input.creatorId },
      select: { role: true },
    });
    if (creator.role !== "creator") {
      throw new Error("Quota grants can only target creator accounts");
    }

    const plan = await tx.creatorPlan.findUniqueOrThrow({
      where: { creatorId: input.creatorId },
    });
    const planUpdate = quotaGrantPlanUpdate(input.resource, input.amount);

    const updatedPlan = await tx.creatorPlan.update({
      where: { creatorId: input.creatorId },
      data: planUpdate,
    });
    const ledgerEntry = await tx.quotaLedgerEntry.create({
      data: {
        creatorId: input.creatorId,
        entryType: "grant",
        resource: input.resource,
        amount: input.amount,
        reason: input.reason || "Admin quota grant",
        createdByAdminId: input.admin.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.admin.id,
        actorRole: input.admin.role,
        action: "quota.grant",
        targetType: "CreatorPlan",
        targetId: input.creatorId,
        before: plan as unknown as Prisma.InputJsonValue,
        after: {
          resource: input.resource,
          amount: input.amount,
          reason: input.reason || "Admin quota grant",
          ledgerEntryId: ledgerEntry.id,
          plan: updatedPlan,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return { plan: updatedPlan, ledgerEntry };
  });
}

function quotaGrantPlanUpdate(resource: QuotaResource, amount: number) {
  switch (resource) {
    case "projects":
      return { maxProjects: { increment: amount } };
    case "ai_messages":
      return { monthlyAiMessageLimit: { increment: amount } };
    case "storage_mb":
      return { storageLimitMb: { increment: amount } };
    case "fan_codes":
      return { fanCodeQuota: { increment: amount } };
  }
}

export async function updateVoiceCloneRequestStatus(input: {
  admin: { id: string; role: UserRole };
  requestId: string;
  status: VoiceCloneStatus;
}) {
  assertPermission(input.admin.role, "clone_requests.review");

  return prisma.$transaction(async (tx) => {
    const before = await tx.voiceCloneRequest.findUniqueOrThrow({
      where: { id: input.requestId },
    });

    const request = await tx.voiceCloneRequest.update({
      where: { id: input.requestId },
      data: { status: input.status },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.admin.id,
        actorRole: input.admin.role,
        action: `voice_clone_request.${input.status}`,
        targetType: "VoiceCloneRequest",
        targetId: request.id,
        before: before as unknown as Prisma.InputJsonValue,
        after: request as unknown as Prisma.InputJsonValue,
      },
    });

    return request;
  });
}
