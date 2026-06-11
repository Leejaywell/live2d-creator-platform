import path from "node:path";

import { AssetUploader, Prisma, UserRole } from "@prisma/client";

import { extractLive2DZipFiles, validateLive2DZip } from "@/lib/live2d-validation";
import { parseModelCapabilities } from "@/lib/model-capabilities";
import { hasPermission } from "@/lib/permissions";
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
  const uploadedBytes = input.data.byteLength + extractedFiles.reduce((sum, file) => sum + file.data.byteLength, 0);

  const modelJsonFile = validation.ok
    ? extractedFiles.find((file) => file.path === validation.modelJsonPath)
    : undefined;
  const capabilities = modelJsonFile
    ? parseModelCapabilities(JSON.parse(modelJsonFile.data.toString("utf8")))
    : null;

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirstOrThrow({
      where: { id: input.projectId, creatorId: input.creatorId },
      include: {
        modelAssets: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    const plan = await tx.creatorPlan.findUniqueOrThrow({
      where: { creatorId: input.creatorId },
    });
    if (!isAdminEmergencyModelUpload(input)) {
      assertCreatorPlanActive(plan);
    }
    const uploadedMb = Math.ceil(uploadedBytes / 1024 / 1024);
    const quota = await tx.creatorPlan.updateMany({
      where: {
        creatorId: input.creatorId,
        usedStorageMb: { lte: plan.storageLimitMb - uploadedMb },
      },
      data: { usedStorageMb: { increment: uploadedMb } },
    });
    if (quota.count !== 1) {
      throw new Error("Storage quota exceeded");
    }

    const version = (project.modelAssets[0]?.version ?? 0) + 1;
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

    await tx.quotaLedgerEntry.create({
      data: {
        creatorId: input.creatorId,
        entryType: "consume",
        resource: "storage_mb",
        amount: -uploadedMb,
        reason: `Live2D model upload for project ${project.id}`,
      },
    });

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

export async function rollbackModelAsset(input: {
  projectId: string;
  creatorId: string;
  modelAssetId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.project.findFirstOrThrow({
      where: { id: input.projectId, creatorId: input.creatorId },
      include: { currentModelAsset: true },
    });

    const target = input.modelAssetId
      ? await tx.modelAsset.findFirstOrThrow({
          where: {
            id: input.modelAssetId,
            projectId: input.projectId,
            validationStatus: "valid",
          },
        })
      : await tx.modelAsset.findFirstOrThrow({
          where: {
            projectId: input.projectId,
            validationStatus: "valid",
            id: before.currentModelAssetId ? { not: before.currentModelAssetId } : undefined,
            version: before.currentModelAsset?.version ? { lt: before.currentModelAsset.version } : undefined,
          },
          orderBy: { version: "desc" },
        });

    if (target.id === before.currentModelAssetId) {
      throw new Error("Model asset is already current");
    }

    const project = await tx.project.update({
      where: { id: input.projectId },
      data: { currentModelAssetId: target.id },
      include: { currentModelAsset: true },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.creatorId,
        actorRole: "creator",
        action: "model_asset.rollback",
        targetType: "Project",
        targetId: project.id,
        before: before as unknown as Prisma.InputJsonValue,
        after: {
          projectId: project.id,
          currentModelAssetId: project.currentModelAssetId,
          currentModelAssetVersion: project.currentModelAsset?.version,
        },
      },
    });

    return project;
  });
}

function sanitizeFileName(value: string) {
  return path.basename(value).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isAdminEmergencyModelUpload(input: {
  actorRole?: UserRole;
  uploadedBy?: AssetUploader;
}) {
  return input.uploadedBy === "admin" && Boolean(input.actorRole && hasPermission(input.actorRole, "assets.assist"));
}
