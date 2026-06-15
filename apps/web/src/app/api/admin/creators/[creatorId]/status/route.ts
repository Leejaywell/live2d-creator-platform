import { NextRequest, NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { z } from "zod";

import { deleteCreatorAccount, updateCreatorStatus } from "@/lib/admin";
import { requirePermission } from "@/lib/authz";
import { jsonError, parseBody } from "@/lib/request";

const statusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

export async function POST(request: NextRequest, context: RouteContext<"/api/admin/creators/[creatorId]/status">) {
  try {
    const session = await requirePermission("creators.manage");
    const { creatorId } = await context.params;
    const body = await parseBody(request, statusSchema);
    const creator = await updateCreatorStatus({
      admin: { id: session.user.id, role: session.user.role },
      creatorId,
      status: body.status,
    });
    return NextResponse.json({ creator });
  } catch (error) {
    return jsonError(error, "Creator status update failed");
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/admin/creators/[creatorId]/status">) {
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
