import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

import { createManualOrder } from "@/lib/admin";
import { requirePermission } from "@/lib/authz";
import { adminOrderProductForSku, checkoutOrderPeriod } from "@/lib/checkout-products";
import { jsonError, parseBody } from "@/lib/request";

const orderSchema = z.object({
  creatorId: z.string().min(1),
  sku: z.string().min(1),
  paymentMethod: z.nativeEnum(PaymentMethod),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("plans.manage");
    const body = await parseBody(request, orderSchema);
    const product = adminOrderProductForSku(body.sku);
    if (!product) {
      throw new Error("Unsupported admin order package");
    }
    if (!product.paymentMethods.includes(body.paymentMethod)) {
      throw new Error("Unsupported payment method for this package");
    }
    const period = checkoutOrderPeriod(product);
    const order = await createManualOrder({
      admin: { id: session.user.id, role: session.user.role },
      creatorId: body.creatorId,
      orderType: product.orderType,
      amount: product.amount,
      paymentMethod: body.paymentMethod,
      planName: product.planName,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      projectQuotaDelta: product.projectQuotaDelta,
      aiMessageQuotaDelta: product.aiMessageQuotaDelta,
      storageQuotaDeltaMb: product.storageQuotaDeltaMb,
      fanCodeQuotaDelta: product.fanCodeQuotaDelta,
      notes: `Admin package order: ${product.sku}`,
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Manual order creation failed");
  }
}
