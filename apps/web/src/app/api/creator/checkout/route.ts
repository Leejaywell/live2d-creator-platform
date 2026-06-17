import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

import { requireSession } from "@/lib/authz";
import { createCreatorCheckoutOrder } from "@/lib/checkout-requests";
import { jsonError, parseBody } from "@/lib/request";

const schema = z.object({
  sku: z.string().min(1),
  paymentMethod: z.nativeEnum(PaymentMethod),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can checkout" }, { status: 403 });
    }
    const body = await parseBody(request, schema);
    const checkout = await createCreatorCheckoutOrder({
      creator: { id: session.user.id, role: session.user.role },
      sku: body.sku,
      paymentMethod: body.paymentMethod,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });
    return NextResponse.json({ checkout }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Checkout failed");
  }
}
