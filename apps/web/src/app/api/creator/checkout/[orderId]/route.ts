import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/authz";
import { voidCreatorCheckoutOrder } from "@/lib/orders";
import { jsonError } from "@/lib/request";

export async function DELETE(request: NextRequest, context: RouteContext<"/api/creator/checkout/[orderId]">) {
  try {
    const session = await requireSession();
    const { orderId } = await context.params;
    const order = await voidCreatorCheckoutOrder(orderId, { id: session.user.id, role: session.user.role }, request.headers.get("x-forwarded-for") ?? undefined);
    return NextResponse.json({ order });
  } catch (error) {
    return jsonError(error, "Checkout order cancellation failed");
  }
}
