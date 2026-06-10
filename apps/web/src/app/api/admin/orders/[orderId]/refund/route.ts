import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/authz";
import { refundManualOrder } from "@/lib/orders";
import { jsonError } from "@/lib/request";

export async function POST(request: NextRequest, context: RouteContext<"/api/admin/orders/[orderId]/refund">) {
  try {
    const session = await requirePermission("orders.confirm");
    const { orderId } = await context.params;
    const order = await refundManualOrder(orderId, { id: session.user.id, role: session.user.role }, request.headers.get("x-forwarded-for") ?? undefined);
    return NextResponse.json({ order });
  } catch (error) {
    return jsonError(error, "Manual order refund failed");
  }
}
