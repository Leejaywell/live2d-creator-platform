import path from "node:path";

import { AssetUploader, Prisma, UserRole } from "@prisma/client";

import { extractLive2DZipFiles, validateLive2DZip } from "@/lib/live2d-validation";
import { parseModelCapabilities } from "@/lib/model-capabilities";
import { hasPermission, isAdminRole } from "@/lib/permissions";
import { assertCreatorPlanActive } from "@/lib/plan-rules";
import { prisma } from "@/lib/prisma";
import { modelAssetBaseKey, putObject } from "@/lib/storage";

export async function uploadModelAsset(input: {
  projectId: string;
  creatorId: string;
  actorId?: string;
  actorRole?: UserRole;
  uploadedBy?: AssetUploader;
  fileName: string;
  data: Buffer;
}) {
  if (!input.fileName.toLowerCase().endsWith(".zip")) {
    throw new Error("Live2D model upload must be a zip file");
  }

  const validation = await validateLive2DZip(input.data);
  const extractedFiles = validation.ok ? await extractLive2DZipFiles(input.data) : [];

  const modelJsonFile = validation.ok
    ? extractedFiles.find((file) => file.path === validation.modelJsonPath)
    : undefined;
  const capabilities = modelJsonFile
    ? parseModelCapabilities(JSON.parse(modelJsonFile.data.toString("utf8")))
    : null;

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirstOrThrow({
      where: { id: input.projectId, creatorId: input.creatorId },
    });

    const plan = await tx.creatorPlan.findUniqueOrThrow({
      where: { creatorId: input.creatorId },
    });
    if (!isAdminEmergencyModelUpload(input)) {
      assertCreatorPlanActive(plan);
    }

    const version = 1;
    const baseKey = modelAssetBaseKey(project.id, version);
    const sourceZip = await putObject({
      key: `${baseKey}/source/${sanitizeFileName(input.fileName)}`,
      body: input.data,
      contentType: "application/zip",
      cacheControl: "private, max-age=0",
    });

    if (validation.ok) {
      await Promise.all(
        extractedFiles.map((file) =>
          putObject({
            key: `${baseKey}/extracted/${file.path}`,
            body: file.data,
            contentType: file.contentType,
            cacheControl: "private, max-age=31536000, immutable",
          }),
        ),
      );
    }

    await tx.project.update({
      where: { id: project.id },
      data: { currentModelAssetId: null },
    });
    await tx.modelAsset.deleteMany({
      where: { projectId: project.id },
    });

    const modelAsset = await tx.modelAsset.create({
      data: {
        projectId: project.id,
        sourceZipUrl: sourceZip.url,
        modelJsonPath: validation.ok ? `${baseKey}/extracted/${validation.modelJsonPath}` : null,
        assetBasePath: validation.ok ? `${baseKey}/extracted` : null,
        validationStatus: validation.ok ? "valid" : "invalid",
        validationErrors: validation.ok ? validation.warnings : validation.errors,
        capabilities: capabilities as Prisma.InputJsonValue | undefined,
        uploadedBy: input.uploadedBy ?? "creator",
        version,
      },
    });

    if (validation.ok) {
      await tx.project.update({
        where: { id: project.id },
        data: { currentModelAssetId: modelAsset.id },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorId ?? input.creatorId,
        actorRole: input.actorRole ?? "creator",
        action: "model_asset.uploaded",
        targetType: "ModelAsset",
        targetId: modelAsset.id,
        after: modelAsset as unknown as Prisma.InputJsonValue,
      },
    });

    return modelAsset;
  });
}

export async function deleteModelAsset(input: {
  projectId: string;
  modelAssetId: string;
  actorId: string;
  actorRole: UserRole;
  creatorId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirstOrThrow({
      where: {
        id: input.projectId,
        creatorId: input.actorRole === "creator" ? input.actorId : input.creatorId,
      },
      include: {
        currentModelAsset: true,
      },
    });
    if (input.actorRole !== "creator" && !isAdminRole(input.actorRole) && !hasPermission(input.actorRole, "assets.assist")) {
      throw new Error("Only asset assistants can delete model assets");
    }

    const asset = await tx.modelAsset.findFirstOrThrow({
      where: {
        id: input.modelAssetId,
        projectId: project.id,
      },
    });

    if (project.currentModelAssetId === asset.id) {
      await tx.project.update({
        where: { id: project.id },
        data: { currentModelAssetId: null },
      });
    }

    const deleted = await tx.modelAsset.delete({
      where: { id: asset.id },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorId,
        actorRole: input.actorRole,
        action: "model_asset.deleted",
        targetType: "ModelAsset",
        targetId: asset.id,
        before: asset as unknown as Prisma.InputJsonValue,
      },
    });

    return deleted;
  });
}

function sanitizeFileName(value: string) {
  return path.basename(value).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isAdminEmergencyModelUpload(input: {
  actorRole?: UserRole;
  uploadedBy?: AssetUploader;
}) {
  return input.uploadedBy === "admin" && Boolean(input.actorRole && (isAdminRole(input.actorRole) || hasPermission(input.actorRole, "assets.assist")));
}
