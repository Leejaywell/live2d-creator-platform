import { FanCodeStatus, ProjectStatus, UserRole, VoiceStatus } from "@prisma/client";

import { projectIdFromStorageKey } from "@/lib/asset-keys";
import { hasPermission } from "@/lib/permissions";
import { assertCreatorPlanActive } from "@/lib/plan-rules";
import { prisma } from "@/lib/prisma";
import { parseStorageKey } from "@/lib/storage";

export async function authorizeAuthenticatedAssetAccess(user: { id: string; role: UserRole }, key: string) {
  const parsedKey = parseStorageKey(key);
  const projectId = projectIdFromStorageKey(parsedKey);
  if (!projectId) {
    throw new Error("Asset key is not project-scoped");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { creatorId: true },
  });
  if (!project) {
    throw new Error("Project asset not found");
  }

  if (project.creatorId === user.id || hasPermission(user.role, "assets.assist")) {
    return {
      key: parsedKey,
      projectId,
    };
  }

  throw new Error("Asset is not available for this account");
}

export async function authorizeAssetAccess(input: {
  user?: { id: string; role: UserRole; status: "active" | "suspended" } | null;
  viewerSessionId?: string | null;
  key: string;
}) {
  if (input.user?.status === "active") {
    try {
      return await authorizeAuthenticatedAssetAccess({ id: input.user.id, role: input.user.role }, input.key);
    } catch (error) {
      if (!input.viewerSessionId) {
        throw error;
      }
    }
  }

  if (!input.viewerSessionId) {
    throw new Error("Unauthorized");
  }

  return authorizeViewerAssetAccess(input.viewerSessionId, input.key);
}

export async function authorizeViewerAssetAccess(viewerSessionId: string, key: string) {
  const parsedKey = parseStorageKey(key);
  const viewerSession = await prisma.viewerSession.findUnique({
    where: { id: viewerSessionId },
    include: {
      fanAccessCode: true,
      project: {
        include: {
          creator: {
            include: {
              creatorPlan: true,
            },
          },
          currentModelAsset: true,
          voiceAssets: {
            where: { status: VoiceStatus.active },
          },
        },
      },
    },
  });

  if (!viewerSession || viewerSession.project.status !== ProjectStatus.published) {
    throw new Error("Unauthorized viewer session");
  }

  if (viewerSession.fanAccessCode.status !== FanCodeStatus.active || viewerSession.fanAccessCode.expiresAt <= new Date()) {
    throw new Error("Access code expired or revoked");
  }
  if (viewerSession.project.creator.status !== "active") {
    throw new Error("Creator account is not active");
  }
  if (!viewerSession.project.creator.creatorPlan) {
    throw new Error("Creator plan is not active");
  }
  assertCreatorPlanActive(viewerSession.project.creator.creatorPlan);

  if (!parsedKey) {
    return {
      key: parsedKey,
      viewerSession,
    };
  }

  const allowedModelPrefix = viewerSession.project.currentModelAsset?.assetBasePath;
  const allowedVoiceKeys = new Set(viewerSession.project.voiceAssets.map((asset) => parseStorageKey(asset.audioUrl)));
  const canAccessModel = Boolean(allowedModelPrefix && parsedKey.startsWith(`${allowedModelPrefix}/`));
  const canAccessVoice = allowedVoiceKeys.has(parsedKey);

  if (!canAccessModel && !canAccessVoice) {
    throw new Error("Asset is not available for this viewer session");
  }

  return {
    key: parsedKey,
    viewerSession,
  };
}
