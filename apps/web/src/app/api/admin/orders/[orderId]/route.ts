import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/authz";
import { deleteManualOrder } from "@/lib/orders";
import { jsonError } from "@/lib/request";

export async function DELETE(request: NextRequest, context: RouteContext<"/api/admin/orders/[orderId]">) {
  try {
    const session = await requirePermission("plans.manage");
    const { orderId } = await context.params;
    const order = await deleteManualOrder(orderId, { id: session.user.id, role: session.user.role }, request.headers.get("x-forwarded-for") ?? undefined);
    return NextResponse.json({ order });
  } catch (error) {
    return jsonError(error, "Manual order deletion failed");
  }
}
