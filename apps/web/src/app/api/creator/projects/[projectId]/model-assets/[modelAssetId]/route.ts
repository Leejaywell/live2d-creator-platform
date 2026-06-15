import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/authz";
import { deleteModelAsset } from "@/lib/model-assets";
import { jsonError } from "@/lib/request";

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]/model-assets/[modelAssetId]">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can delete model assets" }, { status: 403 });
    }

    const { projectId, modelAssetId } = await context.params;
    const modelAsset = await deleteModelAsset({
      projectId,
      modelAssetId,
      actorId: session.user.id,
      actorRole: session.user.role,
    });
    return NextResponse.json({ modelAsset });
  } catch (error) {
    return jsonError(error, "Model asset deletion failed");
  }
}
