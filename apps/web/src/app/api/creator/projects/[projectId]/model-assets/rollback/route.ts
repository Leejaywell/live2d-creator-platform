import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/authz";
import { rollbackModelAsset } from "@/lib/model-assets";
import { jsonError, parseBody } from "@/lib/request";

const rollbackSchema = z.object({
  modelAssetId: z.string().min(1).optional(),
});

export async function POST(request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]/model-assets/rollback">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can rollback model assets" }, { status: 403 });
    }

    const { projectId } = await context.params;
    const body = await parseBody(request, rollbackSchema);
    const project = await rollbackModelAsset({
      projectId,
      creatorId: session.user.id,
      modelAssetId: body.modelAssetId,
    });

    return NextResponse.json({ project });
  } catch (error) {
    return jsonError(error, "Model rollback failed");
  }
}
