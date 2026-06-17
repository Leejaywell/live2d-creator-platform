import { NextRequest, NextResponse } from "next/server";

import { authorizeViewerAssetAccess } from "@/lib/asset-access";
import { InvalidLive2DModelJsonError, parseLive2DModelJson, rewriteModelReferences } from "@/lib/live2d-model-proxy";
import { getObjectBytes, parseStorageKey } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const projectSlug = request.nextUrl.searchParams.get("projectSlug");
  const viewerSessionId = request.nextUrl.searchParams.get("viewerSessionId");
  if (!projectSlug || !viewerSessionId) {
    return NextResponse.json({ error: "Missing projectSlug or viewerSessionId" }, { status: 400 });
  }

  try {
    const access = await authorizeViewerAssetAccess(viewerSessionId, "");
    if (access.viewerSession.project.slug !== projectSlug) {
      return NextResponse.json({ error: "Viewer session does not match project" }, { status: 403 });
    }

    const modelJsonKey = access.viewerSession.project.currentModelAsset?.modelJsonPath;
    if (!modelJsonKey) {
      return NextResponse.json({ error: "Project has no valid Live2D model" }, { status: 404 });
    }

    const parsedKey = parseStorageKey(modelJsonKey);
    const { body } = await getObjectBytes(parsedKey);
    const modelJson = parseLive2DModelJson(body);
    rewriteModelReferences({
      modelJson,
      modelJsonKey: parsedKey,
      viewerSessionId,
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Model access failed" }, { status: 403 });
  }
}
