import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/auth";
import { authorizeAssetAccess } from "@/lib/asset-access";
import { parseLive2DModelJson, rewriteModelReferences } from "@/lib/live2d-model-proxy";
import { findPublicAudienceProject } from "@/lib/public-projects";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/request";
import { getObjectBytes } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectSlug = searchParams.get("projectSlug") ?? "";
    const viewerSessionId = searchParams.get("viewerSessionId") || null;
    if (!projectSlug) {
      return NextResponse.json({ error: "Missing projectSlug" }, { status: 400 });
    }

    const session = await getCurrentSession();

    // Resolve the project + current model. Viewers only see published projects;
    // an authenticated owner/admin can preview their own model directly.
    const project =
      (await findPublicAudienceProject(projectSlug)) ??
      (session?.user
        ? await prisma.project.findFirst({ where: { slug: projectSlug }, include: { currentModelAsset: true } })
        : null);
    const modelJsonKey = project?.currentModelAsset?.modelJsonPath;
    if (!project || !modelJsonKey || project.currentModelAsset?.validationStatus !== "valid") {
      return NextResponse.json({ error: "No valid model for this project" }, { status: 404 });
    }

    // Authorize via viewer session (audience) or the authenticated owner/admin (creator preview).
    await authorizeAssetAccess({ user: session?.user ?? null, viewerSessionId, key: modelJsonKey });

    const { body } = await getObjectBytes(modelJsonKey);
    const modelJson = rewriteModelReferences({
      modelJson: parseLive2DModelJson(body),
      modelJsonKey,
      viewerSessionId: viewerSessionId ?? undefined,
      origin: new URL(request.url).origin,
    });

    return NextResponse.json(modelJson, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "Model manifest unavailable");
  }
}
