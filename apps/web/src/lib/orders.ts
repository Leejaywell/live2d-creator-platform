import { LedgerEntryType, PaymentStatus, Prisma, QuotaResource, UserRole } from "@prisma/client";

import { checkoutSkuFromOrderNotes } from "@/lib/checkout-products";
import { assertOrderCanBeRefunded, assertOrderCanBeVoided } from "@/lib/order-transitions";
import { assertPermission } from "@/lib/permissions";
import { resolveManualOrderPlanPeriod } from "@/lib/plan-periods";
import { prisma } from "@/lib/prisma";

export async function confirmManualOrder(orderId: string, admin: { id: string; role: UserRole }, ipAddress?: string) {
  assertPermission(admin.role, "orders.confirm");
  return confirmManualOrderInternal({
    orderId,
    actorUserId: admin.id,
    actorRole: admin.role,
    action: "manual_order.confirmed",
    ipAddress,
  });
}

export async function confirmManualOrderFromPaymentProvider(orderId: string, input: { provider: string; eventId?: string; ipAddress?: string }) {
  return confirmManualOrderInternal({
    orderId,
    actorUserId: undefined,
    actorRole: undefined,
    action: "manual_order.payment_provider_confirmed",
    ipAddress: input.ipAddress,
    provider: input.provider,
    eventId: input.eventId,
  });
}

export async function voidManualOrder(orderId: string, admin: { id: string; role: UserRole }, ipAddress?: string) {
  assertPermission(admin.role, "orders.confirm");
  return voidManualOrderInternal({
    orderId,
    actorUserId: admin.id,
    actorRole: admin.role,
    action: "manual_order.voided",
    ipAddress,
  });
}

export async function refundManualOrder(orderId: string, admin: { id: string; role: UserRole }, ipAddress?: string) {
  assertPermission(admin.role, "orders.confirm");
  return prisma.$transaction(async (tx) => {
    const order = await tx.manualOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { creator: true },
    });
    assertOrderCanBeRefunded(order);
    if (order.creator.role !== "creator") {
      throw new Error("Manual orders can only be refunded for creator accounts");
    }

    const reversal = reverseOrderQuotaImpact(order);
    await assertManualOrderQuotaImpact(tx, reversal);

    await tx.creatorPlan.update({
      where: { creatorId: order.creatorId },
      data: {
        maxProjects: { increment: reversal.projectQuotaDelta },
        storageLimitMb: { increment: reversal.storageQuotaDeltaMb },
        monthlyAiMessageLimit: { increment: reversal.aiMessageQuotaDelta },
        fanCodeQuota: { increment: reversal.fanCodeQuotaDelta },
      },
    });

    const refundedOrder = await tx.manualOrder.update({
      where: { id: order.id },
      data: { paymentStatus: PaymentStatus.refunded },
    });
    await createLedgerEntries(tx, reversal, admin.id, `Refunded manual order ${order.id}`);

    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        actorRole: admin.role,
        action: "manual_order.refunded",
        targetType: "ManualOrder",
        targetId: order.id,
        before: order as unknown as Prisma.InputJsonValue,
        after: {
          order: refundedOrder,
          reversal,
        } as unknown as Prisma.InputJsonValue,
        ipAddress,
      },
    });

    return refundedOrder;
  });
}

export async function voidCreatorCheckoutOrder(orderId: string, creator: { id: string; role: UserRole }, ipAddress?: string) {
  if (creator.role !== "creator") {
    throw new Error("Only creator accounts can cancel checkout orders");
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.manualOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    if (order.creatorId !== creator.id) {
      throw new Error("Checkout order not found");
    }
    if (!checkoutSkuFromOrderNotes(order.notes)) {
      throw new Error("Only self-service checkout orders can be cancelled by creators");
    }
    assertOrderCanBeVoided(order);

    const voidedOrder = await tx.manualOrder.update({
      where: { id: order.id },
      data: { paymentStatus: PaymentStatus.void },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: creator.id,
        actorRole: creator.role,
        action: "checkout_order.cancelled",
        targetType: "ManualOrder",
        targetId: order.id,
        before: order as unknown as Prisma.InputJsonValue,
        after: voidedOrder as unknown as Prisma.InputJsonValue,
        ipAddress,
      },
    });
    return voidedOrder;
  });
}

async function confirmManualOrderInternal(input: {
  orderId: string;
  actorUserId?: string;
  actorRole?: UserRole;
  action: string;
  ipAddress?: string;
  provider?: string;
  eventId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.manualOrder.findUniqueOrThrow({
      where: { id: input.orderId },
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
      where: { id: input.orderId },
      data: {
        paymentStatus: PaymentStatus.confirmed,
        confirmedByAdminId: input.actorUserId,
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

    await createLedgerEntries(tx, order, input.actorUserId);

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: input.action,
        targetType: "ManualOrder",
        targetId: order.id,
        after: {
          order: confirmedOrder,
          provider: input.provider,
          eventId: input.eventId,
        } as unknown as Prisma.InputJsonValue,
        ipAddress: input.ipAddress,
      },
    });

    return confirmedOrder;
  });
}

async function voidManualOrderInternal(input: {
  orderId: string;
  actorUserId: string;
  actorRole: UserRole;
  action: string;
  ipAddress?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.manualOrder.findUniqueOrThrow({
      where: { id: input.orderId },
    });
    assertOrderCanBeVoided(order);

    const voidedOrder = await tx.manualOrder.update({
      where: { id: order.id },
      data: { paymentStatus: PaymentStatus.void },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: input.action,
        targetType: "ManualOrder",
        targetId: order.id,
        before: order as unknown as Prisma.InputJsonValue,
        after: voidedOrder as unknown as Prisma.InputJsonValue,
        ipAddress: input.ipAddress,
      },
    });
    return voidedOrder;
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

function reverseOrderQuotaImpact(order: {
  id: string;
  creatorId: string;
  projectQuotaDelta: number;
  aiMessageQuotaDelta: number;
  storageQuotaDeltaMb: number;
  fanCodeQuotaDelta: number;
}) {
  return {
    id: order.id,
    creatorId: order.creatorId,
    projectQuotaDelta: -order.projectQuotaDelta,
    aiMessageQuotaDelta: -order.aiMessageQuotaDelta,
    storageQuotaDeltaMb: -order.storageQuotaDeltaMb,
    fanCodeQuotaDelta: -order.fanCodeQuotaDelta,
  };
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
  adminId?: string,
  reason?: string,
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
        reason: reason ?? `Manual order ${order.id}`,
        createdByAdminId: adminId,
      })),
  });
}
