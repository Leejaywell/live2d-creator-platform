import crypto from "node:crypto";

import { notFound } from "next/navigation";

import { getCurrentSession } from "@/auth";
import { fanCodeDisplayStatus } from "@/lib/fan-code-status";
import { prisma } from "@/lib/prisma";
import { projectPublishReadiness } from "@/lib/project-readiness";

import { CreatorAuthRequired } from "../../_components";
import { ProjectWorkspace, type WorkspaceProject } from "./project-workspace";

export const dynamic = "force-dynamic";

export default async function CreatorProjectPage({ params }: PageProps<"/creator/projects/[projectId]">) {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <CreatorAuthRequired title="项目工作区" />;
  }

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, creatorId: session.user.id },
    include: {
      currentModelAsset: true,
      triggerTags: { orderBy: [{ priority: "desc" }, { createdAt: "desc" }] },
      voiceAssets: { orderBy: { createdAt: "desc" } },
      fanAccessCodes: { orderBy: { createdAt: "desc" }, take: 12 },
      _count: { select: { modelAssets: true } },
    },
  });

  if (!project) {
    notFound();
  }

  // Mint a stable debug viewer session so the persistent preview can chat with
  // the model inline (no fan code, no publish gate).
  const codeHash = crypto.createHash("sha256").update(`PREVIEW-${project.id}`).digest("hex");
  const previewCode =
    (await prisma.fanAccessCode.findUnique({ where: { codeHash } })) ??
    (await prisma.fanAccessCode.create({
      data: {
        projectId: project.id,
        codeHash,
        expiresAt: new Date("2099-12-31T23:59:59Z"),
        maxMessages: 9999,
        bindMode: "none",
        status: "active",
        batchId: "preview",
      },
    }));
  const previewSession =
    (await prisma.viewerSession.findUnique({
      where: { fanAccessCodeId_deviceHash: { fanAccessCodeId: previewCode.id, deviceHash: "creator-preview" } },
    })) ??
    (await prisma.viewerSession.create({
      data: { projectId: project.id, fanAccessCodeId: previewCode.id, deviceHash: "creator-preview" },
    }));

  const readiness = projectPublishReadiness(project).map((item) => item.done);

  const workspace: WorkspaceProject = {
    id: project.id,
    name: project.name,
    slug: project.slug,
    status: project.status,
    intro: project.intro ?? "",
    systemPrompt: project.systemPrompt,
    welcomeMessage: project.welcomeMessage,
    theme: project.theme,
    avatarUrl: project.avatarUrl,
    backgroundUrl: project.backgroundUrl,
    modelStatus: project.currentModelAsset?.validationStatus ?? null,
    modelAssetCount: project._count.modelAssets,
    tags: project.triggerTags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      keywords: tag.keywords,
      live2dExpression: tag.live2dExpression,
      priority: tag.priority,
      enabled: tag.enabled,
    })),
    voices: project.voiceAssets.map((voice) => ({ id: voice.id, name: voice.name, status: voice.status })),
    codes: project.fanAccessCodes.map((code) => ({
      id: code.id,
      status: fanCodeDisplayStatus(code),
      display: `#${code.id.slice(0, 8)}`,
      expiresAt: code.expiresAt.toISOString(),
      usedMessages: code.usedMessages,
      maxMessages: code.maxMessages,
    })),
    readiness,
  };

  return <ProjectWorkspace project={workspace} previewSessionId={previewSession.id} />;
}
