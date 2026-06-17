import { NextRequest, NextResponse } from "next/server";

import { requireAdminRole } from "@/lib/authz";
import { InvalidLive2DModelJsonError, parseLive2DModelJson, rewriteModelReferences } from "@/lib/live2d-model-proxy";
import { prisma } from "@/lib/prisma";
import { getObjectBytes, parseStorageKey } from "@/lib/storage";

export async function GET(request: NextRequest, context: RouteContext<"/api/admin/projects/[projectId]/model-assets/[modelAssetId]/preview">) {
  try {
    await requireAdminRole();
    const { projectId, modelAssetId } = await context.params;
    const modelAsset = await prisma.modelAsset.findFirstOrThrow({
      where: {
        id: modelAssetId,
        projectId,
        validationStatus: "valid",
      },
    });

    if (!modelAsset.modelJsonPath) {
      return NextResponse.json({ error: "Model asset has no previewable model JSON" }, { status: 404 });
    }

    const modelJsonKey = parseStorageKey(modelAsset.modelJsonPath);
    const { body } = await getObjectBytes(modelJsonKey);
    const modelJson = parseLive2DModelJson(body);
    rewriteModelReferences({
      modelJson,
      modelJsonKey,
      origin: request.nextUrl.origin,
    });

    return NextResponse.json(modelJson, {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    if (error instanceof InvalidLive2DModelJsonError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Model preview failed" }, { status: 403 });
  }
}
