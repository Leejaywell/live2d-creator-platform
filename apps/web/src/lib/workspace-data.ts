import crypto from "node:crypto";

import type { Prisma } from "@prisma/client";

import type { WorkspaceProject } from "@/app/creator/projects/[projectId]/project-workspace";
import { fanCodeDisplayStatus } from "@/lib/fan-code-status";
import { motionLabel } from "@/lib/live2d-motion-names";
import type { ModelCapabilities } from "@/lib/model-capabilities";
import { prisma } from "@/lib/prisma";
import { projectPublishReadiness } from "@/lib/project-readiness";

// Shared Prisma include + mapper so the creator workspace and the admin config
// view build identical WorkspaceProject data.
export const workspaceProjectInclude = {
  currentModelAsset: true,
  triggerTags: { orderBy: [{ priority: "desc" }, { createdAt: "desc" }] },
  voiceAssets: { orderBy: { createdAt: "desc" }, include: { triggerTags: { select: { name: true } } } },
  fanAccessCodes: { orderBy: { createdAt: "desc" }, take: 12 },
  _count: { select: { modelAssets: true } },
} satisfies Prisma.ProjectInclude;

type LoadedWorkspaceProject = Prisma.ProjectGetPayload<{ include: typeof workspaceProjectInclude }>;

export function buildWorkspaceProject(project: LoadedWorkspaceProject): WorkspaceProject {
  const caps = (project.currentModelAsset?.capabilities ?? null) as ModelCapabilities | null;
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    status: project.status,
    intro: project.intro ?? "",
    systemPrompt: project.systemPrompt,
    characterSetting: project.characterSetting ?? "",
    welcomeMessage: project.welcomeMessage,
    theme: project.theme,
    avatarUrl: project.avatarUrl,
    backgroundUrl: project.backgroundUrl,
    modelStatus: project.currentModelAsset?.validationStatus ?? null,
    modelAssetCount: project._count.modelAssets,
    capabilities: {
      expressions: caps?.expressions.map((e) => e.name).filter(Boolean) ?? [],
      motions: [...new Set((caps?.motions ?? []).map((m) => motionLabel(m.file)).filter(Boolean))],
    },
    tags: project.triggerTags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      keywords: tag.keywords,
      live2dExpression: tag.live2dExpression,
      priority: tag.priority,
      enabled: tag.enabled,
    })),
    voices: project.voiceAssets.map((voice) => ({
      id: voice.id,
      name: voice.name,
      status: voice.status,
      audioUrl: voice.audioUrl,
      tags: voice.triggerTags.map((tag) => tag.name),
    })),
    codes: project.fanAccessCodes.map((code) => ({
      id: code.id,
      status: fanCodeDisplayStatus(code),
      display: `#${code.id.slice(0, 8)}`,
      expiresAt: code.expiresAt.toISOString(),
      usedMessages: code.usedMessages,
      maxMessages: code.maxMessages,
    })),
    readiness: projectPublishReadiness(project).map((item) => item.done),
  };
}

// Mint (or reuse) a stable debug viewer session so the persistent preview can
// chat with the model inline (no fan code, no publish gate).
export async function ensurePreviewSession(projectId: string) {
  const codeHash = crypto.createHash("sha256").update(`PREVIEW-${projectId}`).digest("hex");
  const previewCode =
    (await prisma.fanAccessCode.findUnique({ where: { codeHash } })) ??
    (await prisma.fanAccessCode.create({
      data: {
        projectId,
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
      data: { projectId, fanAccessCodeId: previewCode.id, deviceHash: "creator-preview" },
    }));
  return previewSession.id;
}
