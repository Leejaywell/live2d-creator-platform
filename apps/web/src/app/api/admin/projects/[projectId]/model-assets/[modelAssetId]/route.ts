import { NextRequest, NextResponse } from "next/server";

import { requireAdminRole } from "@/lib/authz";
import { deleteModelAsset } from "@/lib/model-assets";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/request";

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/admin/projects/[projectId]/model-assets/[modelAssetId]">) {
  try {
    const session = await requireAdminRole();
    const { projectId, modelAssetId } = await context.params;
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { creatorId: true },
    });
    const modelAsset = await deleteModelAsset({
      projectId,
      modelAssetId,
      creatorId: project.creatorId,
      actorId: session.user.id,
      actorRole: session.user.role,
    });
    return NextResponse.json({ modelAsset });
  } catch (error) {
    return jsonError(error, "Model asset deletion failed");
  }
}
