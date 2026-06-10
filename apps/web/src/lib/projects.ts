import { Prisma, ProjectStatus, UserRole, VoiceStatus } from "@prisma/client";

import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import { assertProjectPublishReadiness } from "@/lib/project-readiness";
import { prisma } from "@/lib/prisma";
import { initialVoiceCloneStatusForFulfillment } from "@/lib/voice-clone-status";

export async function createProject(input: {
  creatorId: string;
  name: string;
  slug: string;
  intro?: string;
  avatarUrl?: string | null;
  backgroundUrl?: string | null;
  systemPrompt: string;
  welcomeMessage: string;
  theme?: string;
}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const plan = await tx.creatorPlan.findUniqueOrThrow({
            where: { creatorId: input.creatorId },
          });
          if (plan.status !== "active" || plan.expiresAt <= new Date()) {
            throw new Error("Creator plan is not active");
          }

          const projectCount = await tx.project.count({
            where: { creatorId: input.creatorId },
          });
          if (projectCount >= plan.maxProjects) {
            throw new Error("Project quota exceeded");
          }

          const project = await tx.project.create({
            data: {
              creatorId: input.creatorId,
              name: input.name,
              slug: input.slug,
              intro: input.intro,
              avatarUrl: input.avatarUrl,
              backgroundUrl: input.backgroundUrl,
              systemPrompt: input.systemPrompt,
              welcomeMessage: input.welcomeMessage,
              theme: input.theme ?? "#0f766e",
            },
          });

          await tx.auditLog.create({
            data: {
              actorUserId: input.creatorId,
              actorRole: "creator",
              action: "project.created",
              targetType: "Project",
              targetId: project.id,
              after: project as unknown as Prisma.InputJsonValue,
            },
          });

          return project;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (attempt === 0 && isSerializationConflict(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Project creation failed");
}

function isSerializationConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

export async function updateProject(input: {
  projectId: string;
  creatorId: string;
  name?: string;
  slug?: string;
  intro?: string;
  avatarUrl?: string | null;
  backgroundUrl?: string | null;
  systemPrompt?: string;
  welcomeMessage?: string;
  theme?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.project.findFirstOrThrow({
      where: { id: input.projectId, creatorId: input.creatorId },
    });

    const project = await tx.project.update({
      where: { id: input.projectId },
      data: {
        name: input.name,
        slug: input.slug,
        intro: input.intro,
        avatarUrl: input.avatarUrl,
        backgroundUrl: input.backgroundUrl,
        systemPrompt: input.systemPrompt,
        welcomeMessage: input.welcomeMessage,
        theme: input.theme,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.creatorId,
        actorRole: "creator",
        action: "project.updated",
        targetType: "Project",
        targetId: project.id,
        before: before as unknown as Prisma.InputJsonValue,
        after: project as unknown as Prisma.InputJsonValue,
      },
    });

    return project;
  });
}

export async function setProjectStatus(input: {
  projectId: string;
  actorId: string;
  actorRole: UserRole;
  status: ProjectStatus;
  creatorId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirstOrThrow({
      where: {
        id: input.projectId,
        creatorId: input.creatorId,
      },
      include: {
        currentModelAsset: true,
        triggerTags: {
          select: { enabled: true },
        },
        voiceAssets: {
          select: { status: true },
        },
        fanAccessCodes: {
          select: { status: true, expiresAt: true },
        },
      },
    });

    if (input.status === "published") {
      const plan = await tx.creatorPlan.findUniqueOrThrow({
        where: { creatorId: project.creatorId },
      });
      if (plan.status !== "active" || plan.expiresAt <= new Date()) {
        throw new Error("Creator plan is not active");
      }
      if (!project.currentModelAsset || project.currentModelAsset.validationStatus !== "valid") {
        throw new Error("A valid Live2D model is required before publishing");
      }
      assertProjectPublishReadiness(project);
    }

    const updated = await tx.project.update({
      where: { id: input.projectId },
      data: { status: input.status },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorId,
        actorRole: input.actorRole,
        action: `project.${input.status}`,
        targetType: "Project",
        targetId: updated.id,
        after: updated as unknown as Prisma.InputJsonValue,
      },
    });

    return updated;
  });
}

export async function createModelSetupAssistanceRequest(input: {
  projectId: string;
  creatorId: string;
  notes?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirstOrThrow({
      where: { id: input.projectId, creatorId: input.creatorId },
    });

    return tx.auditLog.create({
      data: {
        actorUserId: input.creatorId,
        actorRole: "creator",
        action: "model_setup_assistance.requested",
        targetType: "Project",
        targetId: project.id,
        after: {
          projectId: project.id,
          projectName: project.name,
          notes: input.notes,
        },
      },
    });
  });
}

export async function createTriggerTag(input: {
  projectId: string;
  creatorId: string;
  name: string;
  description?: string;
  keywords: string[];
  promptFragment?: string;
  live2dExpression?: string;
  live2dParams?: Prisma.InputJsonValue;
  priority?: number;
  enabled?: boolean;
  voiceAssetIds?: string[];
}) {
  return prisma.$transaction(async (tx) => {
    await tx.project.findFirstOrThrow({
      where: { id: input.projectId, creatorId: input.creatorId },
    });

    await assertVoiceAssetsBelongToProject(tx, input.projectId, input.voiceAssetIds);

    const tag = await tx.triggerTag.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        keywords: input.keywords,
        promptFragment: input.promptFragment,
        live2dExpression: input.live2dExpression,
        live2dParams: input.live2dParams,
        priority: input.priority ?? 0,
        enabled: input.enabled ?? true,
        voiceAssets: input.voiceAssetIds?.length
          ? {
              connect: input.voiceAssetIds.map((id) => ({ id })),
            }
          : undefined,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.creatorId,
        actorRole: "creator",
        action: "trigger_tag.created",
        targetType: "TriggerTag",
        targetId: tag.id,
        after: tag as unknown as Prisma.InputJsonValue,
      },
    });

    return tag;
  });
}

export async function updateTriggerTag(input: {
  tagId: string;
  projectId: string;
  creatorId: string;
  name?: string;
  description?: string;
  keywords?: string[];
  promptFragment?: string;
  live2dExpression?: string;
  live2dParams?: Prisma.InputJsonValue;
  priority?: number;
  enabled?: boolean;
  voiceAssetIds?: string[];
}) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.triggerTag.findFirstOrThrow({
      where: {
        id: input.tagId,
        projectId: input.projectId,
        project: { creatorId: input.creatorId },
      },
      include: { voiceAssets: true },
    });

    await assertVoiceAssetsBelongToProject(tx, input.projectId, input.voiceAssetIds);

    const tag = await tx.triggerTag.update({
      where: { id: input.tagId },
      data: {
        name: input.name,
        description: input.description,
        keywords: input.keywords,
        promptFragment: input.promptFragment,
        live2dExpression: input.live2dExpression,
        live2dParams: input.live2dParams,
        priority: input.priority,
        enabled: input.enabled,
        voiceAssets: input.voiceAssetIds
          ? {
              set: input.voiceAssetIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: { voiceAssets: true },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.creatorId,
        actorRole: "creator",
        action: "trigger_tag.updated",
        targetType: "TriggerTag",
        targetId: tag.id,
        before: before as unknown as Prisma.InputJsonValue,
        after: tag as unknown as Prisma.InputJsonValue,
      },
    });

    return tag;
  });
}

export async function deleteTriggerTag(input: {
  tagId: string;
  projectId: string;
  creatorId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.triggerTag.findFirstOrThrow({
      where: {
        id: input.tagId,
        projectId: input.projectId,
        project: { creatorId: input.creatorId },
      },
      include: { voiceAssets: true },
    });

    await tx.triggerTag.delete({
      where: { id: input.tagId },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.creatorId,
        actorRole: "creator",
        action: "trigger_tag.deleted",
        targetType: "TriggerTag",
        targetId: input.tagId,
        before: before as unknown as Prisma.InputJsonValue,
      },
    });

    return before;
  });
}

async function assertVoiceAssetsBelongToProject(tx: Prisma.TransactionClient, projectId: string, voiceAssetIds?: string[]) {
  if (!voiceAssetIds?.length) return;

  const count = await tx.voiceAsset.count({
    where: {
      id: { in: voiceAssetIds },
      projectId,
    },
  });
  if (count !== voiceAssetIds.length) {
    throw new Error("Voice assets must belong to the same project");
  }
}

export async function updateVoiceAsset(input: {
  voiceAssetId: string;
  projectId: string;
  creatorId: string;
  name?: string;
  durationMs?: number;
  tags?: string[];
  status?: VoiceStatus;
}) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.voiceAsset.findFirstOrThrow({
      where: {
        id: input.voiceAssetId,
        projectId: input.projectId,
        project: { creatorId: input.creatorId },
      },
    });

    const voice = await tx.voiceAsset.update({
      where: { id: input.voiceAssetId },
      data: {
        name: input.name,
        durationMs: input.durationMs,
        tags: input.tags,
        status: input.status,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.creatorId,
        actorRole: "creator",
        action: "voice_asset.updated",
        targetType: "VoiceAsset",
        targetId: voice.id,
        before: before as unknown as Prisma.InputJsonValue,
        after: voice as unknown as Prisma.InputJsonValue,
      },
    });

    return voice;
  });
}

export async function disableVoiceAsset(input: {
  voiceAssetId: string;
  projectId: string;
  creatorId: string;
}) {
  return updateVoiceAsset({
    ...input,
    status: "disabled",
  });
}

export async function createVoiceCloneRequest(input: {
  projectId: string;
  creatorId: string;
  authorizationConfirmed: boolean;
  notes?: string;
}) {
  if (!input.authorizationConfirmed) {
    throw new Error("Voice clone authorization confirmation is required");
  }

  const settings = await getPlatformRuntimeSettings();
  const initialStatus = initialVoiceCloneStatusForFulfillment(settings.voiceCloningFulfillment);

  return prisma.$transaction(async (tx) => {
    await tx.project.findFirstOrThrow({
      where: { id: input.projectId, creatorId: input.creatorId },
    });

    const request = await tx.voiceCloneRequest.create({
      data: {
        projectId: input.projectId,
        creatorId: input.creatorId,
        status: initialStatus,
        authorizationConfirmed: true,
        notes: input.notes,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.creatorId,
        actorRole: "creator",
        action: "voice_clone_request.created",
        targetType: "VoiceCloneRequest",
        targetId: request.id,
        after: {
          ...request,
          fulfillmentMode: settings.voiceCloningFulfillment,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return request;
  });
}
