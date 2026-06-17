import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/authz";
import { deleteManualOrder } from "@/lib/orders";
import { jsonError } from "@/lib/request";

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/admin/orders/[orderId]">) {
  try {
    const session = await requirePermission("plans.manage");
    const { orderId } = await context.params;
    await deleteManualOrder(orderId, { id: session.user.id, role: session.user.role });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "Order deletion failed");
  }
}
