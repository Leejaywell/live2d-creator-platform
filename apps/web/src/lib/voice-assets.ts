import path from "node:path";

import { Prisma, UserRole } from "@prisma/client";

import { hasPermission } from "@/lib/permissions";
import { assertCreatorPlanActive } from "@/lib/plan-rules";
import { prisma } from "@/lib/prisma";
import { putObject, voiceAssetKey } from "@/lib/storage";

const allowedAudioTypes = new Map([
  ["audio/mpeg", ".mp3"],
  ["audio/mp3", ".mp3"],
  ["audio/wav", ".wav"],
  ["audio/x-wav", ".wav"],
]);

export async function uploadVoiceAsset(input: {
  projectId: string;
  creatorId: string;
  actorId?: string;
  actorRole?: UserRole;
  name: string;
  fileName: string;
  contentType: string;
  data: Buffer;
  tags?: string[];
}) {
  const extension = extensionForAudio(input.fileName, input.contentType);
  if (!extension) {
    throw new Error("Voice upload must be WAV or MP3");
  }

  const uploadedMb = Math.ceil(input.data.byteLength / 1024 / 1024);

  return prisma.$transaction(async (tx) => {
    await tx.project.findFirstOrThrow({
      where: { id: input.projectId, creatorId: input.creatorId },
    });

    const plan = await tx.creatorPlan.findUniqueOrThrow({
      where: { creatorId: input.creatorId },
    });
    if (!isAdminAssistedVoiceUpload(input.actorRole)) {
      assertCreatorPlanActive(plan);
    }
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

    const id = crypto.randomUUID();
    const object = await putObject({
      key: voiceAssetKey(input.projectId, id, extension),
      body: input.data,
      contentType: input.contentType || contentTypeForAudioExtension(extension),
      cacheControl: "private, max-age=31536000, immutable",
    });

    const voice = await tx.voiceAsset.create({
      data: {
        id,
        projectId: input.projectId,
        name: input.name,
        audioUrl: object.url,
        status: "active",
      },
    });

    await tx.quotaLedgerEntry.create({
      data: {
        creatorId: input.creatorId,
        entryType: "consume",
        resource: "storage_mb",
        amount: -uploadedMb,
        reason: `Voice asset upload for project ${input.projectId}`,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorId ?? input.creatorId,
        actorRole: input.actorRole ?? "creator",
        action: "voice_asset.uploaded",
        targetType: "VoiceAsset",
        targetId: voice.id,
        after: voice as unknown as Prisma.InputJsonValue,
      },
    });

    return voice;
  });
}

export async function replaceVoiceAssetAudio(input: {
  projectId: string;
  creatorId: string;
  actorId?: string;
  actorRole?: UserRole;
  voiceAssetId: string;
  name?: string;
  fileName: string;
  contentType: string;
  data: Buffer;
  tags?: string[];
}) {
  const extension = extensionForAudio(input.fileName, input.contentType);
  if (!extension) {
    throw new Error("Voice upload must be WAV or MP3");
  }

  const uploadedMb = Math.ceil(input.data.byteLength / 1024 / 1024);

  return prisma.$transaction(async (tx) => {
    const before = await tx.voiceAsset.findFirstOrThrow({
      where: {
        id: input.voiceAssetId,
        projectId: input.projectId,
        project: { creatorId: input.creatorId },
      },
    });

    const plan = await tx.creatorPlan.findUniqueOrThrow({
      where: { creatorId: input.creatorId },
    });
    if (!isAdminAssistedVoiceUpload(input.actorRole)) {
      assertCreatorPlanActive(plan);
    }
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

    const object = await putObject({
      key: voiceAssetKey(input.projectId, input.voiceAssetId, extension),
      body: input.data,
      contentType: input.contentType || contentTypeForAudioExtension(extension),
      cacheControl: "private, max-age=31536000, immutable",
    });

    const voice = await tx.voiceAsset.update({
      where: { id: input.voiceAssetId },
      data: {
        name: input.name || before.name,
        audioUrl: object.url,
        status: "active",
      },
    });

    await tx.quotaLedgerEntry.create({
      data: {
        creatorId: input.creatorId,
        entryType: "consume",
        resource: "storage_mb",
        amount: -uploadedMb,
        reason: `Voice asset replacement for project ${input.projectId}`,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorId ?? input.creatorId,
        actorRole: input.actorRole ?? "creator",
        action: "voice_asset.audio_replaced",
        targetType: "VoiceAsset",
        targetId: voice.id,
        before: before as unknown as Prisma.InputJsonValue,
        after: voice as unknown as Prisma.InputJsonValue,
      },
    });

    return voice;
  });
}

function extensionForAudio(fileName: string, contentType: string) {
  if (allowedAudioTypes.has(contentType)) {
    return allowedAudioTypes.get(contentType);
  }

  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".mp3" || extension === ".wav") {
    return extension;
  }
  return null;
}

function contentTypeForAudioExtension(extension: string) {
  return extension === ".mp3" ? "audio/mpeg" : "audio/wav";
}

function isAdminAssistedVoiceUpload(actorRole?: UserRole) {
  return Boolean(actorRole && hasPermission(actorRole, "assets.assist"));
}
