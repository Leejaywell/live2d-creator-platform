import { Prisma, ProjectStatus, UserRole } from "@prisma/client";

import { assertPermission } from "@/lib/permissions";
import { assertProjectPublishReadiness } from "@/lib/project-readiness";
import { prisma } from "@/lib/prisma";

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
          if (projectCount >= 1) {
            throw new Error("Creator model slot already exists");
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

export async function deleteProject(input: {
  projectId: string;
  actorId: string;
  actorRole: UserRole;
  creatorId?: string;
}) {
  if (input.actorRole === "creator") {
    if (input.creatorId !== input.actorId) {
      throw new Error("Creators can only delete their own projects");
    }
  } else {
    assertPermission(input.actorRole, "projects.pause");
  }

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirstOrThrow({
      where: {
        id: input.projectId,
        creatorId: input.creatorId,
      },
      include: {
        currentModelAsset: true,
        _count: {
          select: {
            modelAssets: true,
            triggerTags: true,
            fanAccessCodes: true,
            viewerSessions: true,
          },
        },
      },
    });

    await tx.project.update({
      where: { id: project.id },
      data: { currentModelAssetId: null },
    });
    const deleted = await tx.project.delete({
      where: { id: project.id },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorId,
        actorRole: input.actorRole,
        action: "project.deleted",
        targetType: "Project",
        targetId: project.id,
        before: project as unknown as Prisma.InputJsonValue,
      },
    });

    return deleted;
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
}) {
  return prisma.$transaction(async (tx) => {
    await tx.project.findFirstOrThrow({
      where: { id: input.projectId, creatorId: input.creatorId },
    });

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
}) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.triggerTag.findFirstOrThrow({
      where: {
        id: input.tagId,
        projectId: input.projectId,
        project: { creatorId: input.creatorId },
      },
    });

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
      },
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
