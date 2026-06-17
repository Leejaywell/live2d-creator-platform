import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

import { createManualOrder } from "@/lib/admin";
import { requirePermission } from "@/lib/authz";
import { adminOrderProductForSku, checkoutOrderPeriod } from "@/lib/checkout-products";
import { jsonError, parseBody } from "@/lib/request";

const schema = z.object({
  creatorId: z.string().min(1),
  paymentMethod: z.nativeEnum(PaymentMethod),
  sku: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("plans.manage");
    const body = await parseBody(request, schema);
    const product = adminOrderProductForSku(body.sku);
    if (!product) {
      return NextResponse.json({ error: "Unknown product" }, { status: 400 });
    }
    const period = checkoutOrderPeriod(product);
    const periodStart = "periodStart" in period ? period.periodStart : undefined;
    const periodEnd = "periodEnd" in period ? period.periodEnd : undefined;
    const order = await createManualOrder({
      admin: { id: session.user.id, role: session.user.role },
      creatorId: body.creatorId,
      orderType: product.orderType,
      amount: product.amount,
      paymentMethod: body.paymentMethod,
      planName: product.planName,
      periodStart,
      periodEnd,
      projectQuotaDelta: product.projectQuotaDelta,
      aiMessageQuotaDelta: product.aiMessageQuotaDelta,
      storageQuotaDeltaMb: product.storageQuotaDeltaMb,
      fanCodeQuotaDelta: product.fanCodeQuotaDelta,
      notes: `sku:${product.sku}`,
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Order creation failed");
  }
}
