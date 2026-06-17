import { NextRequest, NextResponse } from "next/server";

import { authorizeViewerAssetAccess } from "@/lib/asset-access";
import { parseLive2DModelJson, rewriteModelReferences } from "@/lib/live2d-model-proxy";
import { findPublicAudienceProject } from "@/lib/public-projects";
import { jsonError } from "@/lib/request";
import { getObjectBytes } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectSlug = searchParams.get("projectSlug") ?? "";
    const viewerSessionId = searchParams.get("viewerSessionId") ?? "";
    if (!projectSlug || !viewerSessionId) {
      return NextResponse.json({ error: "Missing projectSlug or viewerSessionId" }, { status: 400 });
    }

    const project = await findPublicAudienceProject(projectSlug);
    const modelJsonKey = project?.currentModelAsset?.modelJsonPath;
    if (!project || !modelJsonKey || project.currentModelAsset?.validationStatus !== "valid") {
      return NextResponse.json({ error: "No valid model for this project" }, { status: 404 });
    }

    // Authorize the viewer session against the model key before serving the manifest.
    await authorizeViewerAssetAccess(viewerSessionId, modelJsonKey);

    const { body } = await getObjectBytes(modelJsonKey);
    const modelJson = rewriteModelReferences({
      modelJson: parseLive2DModelJson(body),
      modelJsonKey,
      viewerSessionId,
      origin: new URL(request.url).origin,
    });

    return NextResponse.json(modelJson, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonError(error, "Model manifest unavailable");
  }
}
