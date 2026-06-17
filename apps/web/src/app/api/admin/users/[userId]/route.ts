import { NextRequest, NextResponse } from "next/server";

import { deleteAdminUser } from "@/lib/admin";
import { requirePermission } from "@/lib/authz";
import { jsonError } from "@/lib/request";

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/admin/users/[userId]">) {
  try {
    const session = await requirePermission("admin.users.manage");
    const { userId } = await context.params;
    await deleteAdminUser({ admin: { id: session.user.id, role: session.user.role }, userId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "Admin user deletion failed");
  }
}
