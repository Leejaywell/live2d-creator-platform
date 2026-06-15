import { NextRequest, NextResponse } from "next/server";

import { deleteCreatorAccount } from "@/lib/admin";
import { requirePermission } from "@/lib/authz";
import { jsonError } from "@/lib/request";

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/admin/creators/[creatorId]">) {
  try {
    const session = await requirePermission("creators.manage");
    const { creatorId } = await context.params;
    const creator = await deleteCreatorAccount({
      admin: { id: session.user.id, role: session.user.role },
      creatorId,
    });
    return NextResponse.json({ creator });
  } catch (error) {
    return jsonError(error, "Creator deletion failed");
  }
}
