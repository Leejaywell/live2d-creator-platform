import { LedgerEntryType, PaymentStatus, Prisma, QuotaResource, UserRole } from "@prisma/client";

import { assertPermission } from "@/lib/permissions";
import { resolveManualOrderPlanPeriod } from "@/lib/plan-periods";
import { prisma } from "@/lib/prisma";

export async function confirmManualOrder(orderId: string, admin: { id: string; role: UserRole }, ipAddress?: string) {
  assertPermission(admin.role, "orders.confirm");

  return prisma.$transaction(async (tx) => {
    const order = await tx.manualOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { creator: true },
    });

    if (order.paymentStatus === PaymentStatus.confirmed) {
      throw new Error("Order is already confirmed");
    }
    if (order.creator.role !== "creator") {
      throw new Error("Manual orders can only be confirmed for creator accounts");
    }

    await assertManualOrderQuotaImpact(tx, order);
    const planPeriod = resolveManualOrderPlanPeriod(order);

    const confirmedOrder = await tx.manualOrder.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.confirmed,
        confirmedByAdminId: admin.id,
        confirmedAt: new Date(),
      },
    });

    await tx.creatorPlan.upsert({
      where: { creatorId: order.creatorId },
      create: {
        creatorId: order.creatorId,
        planName: order.planName ?? "Manual Plan",
        startsAt: planPeriod.startsAt,
        expiresAt: planPeriod.expiresAt,
        maxProjects: Math.max(order.projectQuotaDelta, 1),
        storageLimitMb: Math.max(order.storageQuotaDeltaMb, 0),
        monthlyAiMessageLimit: Math.max(order.aiMessageQuotaDelta, 0),
        fanCodeQuota: Math.max(order.fanCodeQuotaDelta, 0),
      },
      update: {
        planName: order.planName ?? undefined,
        startsAt: order.periodStart ? planPeriod.startsAt : undefined,
        expiresAt: order.periodEnd || order.periodStart ? planPeriod.expiresAt : undefined,
        maxProjects: { increment: order.projectQuotaDelta },
        storageLimitMb: { increment: order.storageQuotaDeltaMb },
        monthlyAiMessageLimit: { increment: order.aiMessageQuotaDelta },
        fanCodeQuota: { increment: order.fanCodeQuotaDelta },
        status: "active",
      },
    });

    await createLedgerEntries(tx, order, admin.id);

    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        actorRole: admin.role,
        action: "manual_order.confirmed",
        targetType: "ManualOrder",
        targetId: order.id,
        after: confirmedOrder as unknown as Prisma.InputJsonValue,
        ipAddress,
      },
    });

    return confirmedOrder;
  });
}

async function assertManualOrderQuotaImpact(
  tx: Prisma.TransactionClient,
  order: {
    creatorId: string;
    projectQuotaDelta: number;
    aiMessageQuotaDelta: number;
    storageQuotaDeltaMb: number;
    fanCodeQuotaDelta: number;
  },
) {
  const [plan, projectCount] = await Promise.all([
    tx.creatorPlan.findUnique({ where: { creatorId: order.creatorId } }),
    tx.project.count({ where: { creatorId: order.creatorId } }),
  ]);

  if (!plan) {
    if (order.projectQuotaDelta < 0 || order.aiMessageQuotaDelta < 0 || order.storageQuotaDeltaMb < 0 || order.fanCodeQuotaDelta < 0) {
      throw new Error("Manual order cannot reduce quota before a creator plan exists");
    }
    return;
  }

  const next = {
    maxProjects: plan.maxProjects + order.projectQuotaDelta,
    monthlyAiMessageLimit: plan.monthlyAiMessageLimit + order.aiMessageQuotaDelta,
    storageLimitMb: plan.storageLimitMb + order.storageQuotaDeltaMb,
    fanCodeQuota: plan.fanCodeQuota + order.fanCodeQuotaDelta,
  };

  if (next.maxProjects < projectCount) {
    throw new Error("Manual order would reduce project quota below current usage");
  }
  if (next.monthlyAiMessageLimit < plan.usedAiMessages) {
    throw new Error("Manual order would reduce AI message quota below current usage");
  }
  if (next.storageLimitMb < plan.usedStorageMb) {
    throw new Error("Manual order would reduce storage quota below current usage");
  }
  if (next.fanCodeQuota < plan.usedFanCodes) {
    throw new Error("Manual order would reduce fan-code quota below current usage");
  }
}

async function createLedgerEntries(
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    creatorId: string;
    projectQuotaDelta: number;
    aiMessageQuotaDelta: number;
    storageQuotaDeltaMb: number;
    fanCodeQuotaDelta: number;
  },
  adminId: string,
) {
  const entries = [
    [QuotaResource.projects, order.projectQuotaDelta],
    [QuotaResource.ai_messages, order.aiMessageQuotaDelta],
    [QuotaResource.storage_mb, order.storageQuotaDeltaMb],
    [QuotaResource.fan_codes, order.fanCodeQuotaDelta],
  ] as const;

  await tx.quotaLedgerEntry.createMany({
    data: entries
      .filter(([, amount]) => amount !== 0)
      .map(([resource, amount]) => ({
        creatorId: order.creatorId,
        manualOrderId: order.id,
        entryType: amount > 0 ? LedgerEntryType.grant : LedgerEntryType.adjustment,
        resource,
        amount,
        reason: `Manual order ${order.id}`,
        createdByAdminId: adminId,
      })),
  });
}
