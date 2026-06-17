import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/authz";
import { voidCreatorCheckoutOrder } from "@/lib/orders";
import { jsonError } from "@/lib/request";

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/creator/checkout/[orderId]">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can cancel their orders" }, { status: 403 });
    }
    const { orderId } = await context.params;
    await voidCreatorCheckoutOrder(orderId, { id: session.user.id, role: session.user.role });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "Order cancellation failed");
  }
}
