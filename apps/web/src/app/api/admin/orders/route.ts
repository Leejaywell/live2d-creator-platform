import { NextRequest, NextResponse } from "next/server";
import { OrderType, PaymentMethod } from "@prisma/client";
import { z } from "zod";

import { createManualOrder } from "@/lib/admin";
import { requirePermission } from "@/lib/authz";
import { jsonError, parseBody } from "@/lib/request";

const optionalDateTime = z.preprocess((value) => (value === "" ? undefined : value), z.string().datetime().optional());
const optionalNonEmptyString = z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional());
const amountSchema = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Amount must use up to two decimal places");

const orderSchema = z.object({
  creatorId: z.string().min(1),
  orderType: z.nativeEnum(OrderType).optional(),
  amount: amountSchema,
  paymentMethod: z.nativeEnum(PaymentMethod),
  planName: optionalNonEmptyString,
  periodStart: optionalDateTime,
  periodEnd: optionalDateTime,
  projectQuotaDelta: z.number().int().default(0),
  aiMessageQuotaDelta: z.number().int().default(0),
  storageQuotaDeltaMb: z.number().int().default(0),
  fanCodeQuotaDelta: z.number().int().default(0),
  notes: optionalNonEmptyString,
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("plans.manage");
    const body = await parseBody(request, orderSchema);
    const order = await createManualOrder({
      admin: { id: session.user.id, role: session.user.role },
      ...body,
      periodStart: body.periodStart ? new Date(body.periodStart) : undefined,
      periodEnd: body.periodEnd ? new Date(body.periodEnd) : undefined,
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Manual order creation failed");
  }
}
