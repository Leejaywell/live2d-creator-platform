import { PaymentMethod, Prisma, UserRole } from "@prisma/client";

import { adminOrderProductForSku, checkoutOrderPeriod } from "@/lib/checkout-products";
import { prisma } from "@/lib/prisma";

export async function createCreatorCheckoutOrder(input: {
  creator: { id: string; role: UserRole };
  sku: string;
  paymentMethod: PaymentMethod;
  ipAddress?: string;
}) {
  if (input.creator.role !== "creator") {
    throw new Error("Checkout orders can only be created by creator accounts");
  }
  const product = adminOrderProductForSku(input.sku);
  if (!product) {
    throw new Error("Unsupported checkout package");
  }
  if (!product.paymentMethods.includes(input.paymentMethod)) {
    throw new Error("Unsupported payment method for this checkout product");
  }

  const period = checkoutOrderPeriod(product);
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.manualOrder.create({
      data: {
        creatorId: input.creator.id,
        orderType: product.orderType,
        amount: new Prisma.Decimal(product.amount),
        currency: product.currency,
        paymentMethod: input.paymentMethod,
        planName: product.planName,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        projectQuotaDelta: product.projectQuotaDelta,
        aiMessageQuotaDelta: product.aiMessageQuotaDelta,
        storageQuotaDeltaMb: product.storageQuotaDeltaMb,
        fanCodeQuotaDelta: product.fanCodeQuotaDelta,
        notes: `Creator package request: ${product.sku}`,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.creator.id,
        actorRole: input.creator.role,
        action: "checkout_order.requested",
        targetType: "ManualOrder",
        targetId: created.id,
        after: {
          order: created,
          sku: product.sku,
          checkoutUrlConfigured: Boolean(process.env.PAYMENT_CHECKOUT_URL_TEMPLATE),
        } as unknown as Prisma.InputJsonValue,
        ipAddress: input.ipAddress,
      },
    });

    return created;
  });

  return {
    order,
    product,
    checkoutUrl: undefined,
  };
}
