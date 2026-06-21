import { NextResponse } from "next/server";

import { getCurrentSession } from "@/auth";
import { isAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/request";
import { buildStandalonePreviewHtml } from "@/lib/standalone-preview/build-html";

export const dynamic = "force-dynamic";

// Admin-only: download a single self-contained HTML file that reproduces the
// full local preview (model + controls + voice + chat) for one project, with
// every asset embedded inline so it works offline.
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const session = await getCurrentSession();
    if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { projectId } = await params;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        currentModelAsset: true,
        triggerTags: { where: { enabled: true } },
        voiceAssets: { include: { triggerTags: { select: { name: true } } } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const modelJsonPath = project.currentModelAsset?.modelJsonPath;
    if (!modelJsonPath || project.currentModelAsset?.validationStatus !== "valid") {
      return NextResponse.json({ error: "Project has no valid Live2D model" }, { status: 409 });
    }

    const html = await buildStandalonePreviewHtml({
      slug: project.slug,
      name: project.name,
      theme: project.theme,
      systemPrompt: project.systemPrompt,
      welcomeMessage: project.welcomeMessage,
      characterSetting: project.characterSetting,
      avatarUrl: project.avatarUrl,
      backgroundUrl: project.backgroundUrl,
      modelJsonPath,
      voices: project.voiceAssets.map((voice) => ({
        name: voice.name,
        audioUrl: voice.audioUrl,
        tags: voice.triggerTags.map((tag) => tag.name),
      })),
      triggerTags: project.triggerTags.map((tag) => ({
        name: tag.name,
        keywords: tag.keywords,
        live2dExpression: tag.live2dExpression,
        promptFragment: tag.promptFragment,
      })),
    });

    const filename = `${project.slug || "preview"}-preview.html`;
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error, "Failed to build preview export");
  }
}
