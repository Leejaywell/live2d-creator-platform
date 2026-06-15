import { OrderType, PaymentMethod, Prisma, QuotaResource, UserRole, UserStatus } from "@prisma/client";

import { internalEmailForUsername, normalizeUsername } from "@/lib/account-identity";
import { assertManualOrderAllowedForCheckout } from "@/lib/checkout-modes";
import { hashPassword } from "@/lib/password-auth";
import { assertPermission } from "@/lib/permissions";
import { assertFuturePlanExpiration, defaultPlanExpiresAt, resolveManualOrderPlanPeriod } from "@/lib/plan-periods";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";

export async function upsertAdminUser(input: {
  admin: { id: string; role: UserRole };
  username: string;
  password?: string;
  role: Exclude<UserRole, "creator">;
  status: UserStatus;
}) {
  assertPermission(input.admin.role, "admin.users.manage");
  const username = normalizeUsername(input.username);

  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { username },
    });
    if (!before && !input.password) {
      throw new Error("Password is required for new admin users");
    }

    if (before?.id === input.admin.id && (input.role !== "super_admin" || input.status !== "active")) {
      throw new Error("Super admins cannot demote or suspend their own account");
    }

    const passwordHash = input.password ? await hashPassword(input.password) : undefined;
    const user = await tx.user.upsert({
      where: { username },
      update: {
        role: input.role,
        status: input.status,
        passwordHash,
      },
      create: {
        username,
        email: internalEmailForUsername(username),
        role: input.role,
        status: input.status,
        passwordHash,
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
  username: string;
  password?: string;
  displayName: string;
  planName?: string;
  expiresAt?: Date;
  maxProjects?: number;
  monthlyAiMessageLimit?: number;
  fanCodeQuota?: number;
}) {
  assertPermission(input.admin.role, "creators.manage");
  const username = normalizeUsername(input.username);

  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { username },
      select: { role: true },
    });
    if (!existingUser && !input.password) {
      throw new Error("Password is required for new creator users");
    }
    if (existingUser && existingUser.role !== "creator") {
      throw new Error("Creator accounts cannot replace admin accounts");
    }

    const passwordHash = input.password ? await hashPassword(input.password) : undefined;
    const creator = await tx.user.upsert({
      where: { username },
      update: {
        role: "creator",
        status: "active",
        passwordHash,
      },
      create: {
        username,
        email: internalEmailForUsername(username),
        role: "creator",
        status: "active",
        passwordHash,
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
          storageLimitMb: 0,
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
          username,
          displayName: input.displayName,
          planName: input.planName,
          maxProjects: input.maxProjects,
          monthlyAiMessageLimit: input.monthlyAiMessageLimit,
          fanCodeQuota: input.fanCodeQuota,
        },
      },
    });

    return creator;
  });
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

export async function deleteAdminUser(input: {
  admin: { id: string; role: UserRole };
  userId: string;
}) {
  assertPermission(input.admin.role, "admin.users.manage");
  if (input.admin.id === input.userId) {
    throw new Error("Admins cannot delete their own account");
  }

  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
    });
    if (before.role === "creator") {
      throw new Error("Use creator deletion for creator accounts");
    }
    if (before.role === "super_admin") {
      const activeSuperAdmins = await tx.user.count({
        where: { role: "super_admin", status: "active", id: { not: input.userId } },
      });
      if (activeSuperAdmins < 1) {
        throw new Error("At least one active super admin must remain");
      }
    }

    await detachUserReferences(tx, input.userId);
    const deleted = await tx.user.delete({
      where: { id: input.userId },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.admin.id,
        actorRole: input.admin.role,
        action: "admin_user.deleted",
        targetType: "User",
        targetId: deleted.id,
        before: before as unknown as Prisma.InputJsonValue,
      },
    });

    return deleted;
  });
}

export async function deleteCreatorAccount(input: {
  admin: { id: string; role: UserRole };
  creatorId: string;
}) {
  assertPermission(input.admin.role, "creators.manage");

  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUniqueOrThrow({
      where: { id: input.creatorId },
    });
    if (before.role !== "creator") {
      throw new Error("Only creator accounts can be deleted with this action");
    }

    await tx.project.updateMany({
      where: { creatorId: input.creatorId },
      data: { currentModelAssetId: null },
    });
    await detachUserReferences(tx, input.creatorId);
    const deleted = await tx.user.delete({
      where: { id: input.creatorId },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.admin.id,
        actorRole: input.admin.role,
        action: "creator_account.deleted",
        targetType: "User",
        targetId: deleted.id,
        before: before as unknown as Prisma.InputJsonValue,
      },
    });

    return deleted;
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
    case "fan_codes":
      return { fanCodeQuota: { increment: amount } };
    default:
      throw new Error("Unsupported quota resource");
  }
}

async function detachUserReferences(tx: Prisma.TransactionClient, userId: string) {
  await Promise.all([
    tx.auditLog.updateMany({ where: { actorUserId: userId }, data: { actorUserId: null } }),
    tx.manualOrder.updateMany({ where: { createdByAdminId: userId }, data: { createdByAdminId: null } }),
    tx.manualOrder.updateMany({ where: { confirmedByAdminId: userId }, data: { confirmedByAdminId: null } }),
    tx.quotaLedgerEntry.updateMany({ where: { createdByAdminId: userId }, data: { createdByAdminId: null } }),
  ]);
}
