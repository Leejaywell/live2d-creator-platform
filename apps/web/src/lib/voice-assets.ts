import { randomUUID } from "node:crypto";
import path from "node:path";

import { Prisma } from "@prisma/client";

import { assertCreatorPlanActive } from "@/lib/plan-rules";
import { prisma } from "@/lib/prisma";
import { deleteObject, putObject } from "@/lib/storage";

const ALLOWED_EXTENSIONS = new Set([".ogg", ".mp3", ".wav", ".m4a"]);
const MAX_VOICE_BYTES = Number(process.env.MAX_VOICE_BYTES || 12 * 1024 * 1024); // 12 MB

function contentTypeFor(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  return "application/octet-stream";
}

/** True when the URL is a public/static path (seeded voices) rather than a
 * protected object-storage key (creator uploads). */
export function isStaticVoiceUrl(audioUrl: string) {
  return /^(https?:)?\/\//.test(audioUrl) || audioUrl.startsWith("/");
}

export async function uploadVoiceAsset(input: {
  projectId: string;
  creatorId: string;
  name: string;
  fileName: string;
  data: Buffer;
}) {
  const ext = path.extname(input.fileName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error("Voice file must be .ogg, .mp3, .wav, or .m4a");
  }
  if (input.data.byteLength > MAX_VOICE_BYTES) {
    throw new Error("Voice file is too large");
  }

  const project = await prisma.project.findFirstOrThrow({
    where: { id: input.projectId, creatorId: input.creatorId },
  });
  const plan = await prisma.creatorPlan.findUniqueOrThrow({ where: { creatorId: input.creatorId } });
  assertCreatorPlanActive(plan);

  const voiceId = randomUUID();
  const safeName = path.basename(input.fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `projects/${project.id}/voices/${voiceId}/${safeName}`;
  await putObject({
    key,
    body: input.data,
    contentType: contentTypeFor(input.fileName),
    cacheControl: "private, max-age=86400",
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const voice = await tx.voiceAsset.create({
        data: {
          projectId: project.id,
          name: (input.name || safeName).slice(0, 100),
          audioUrl: key,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: input.creatorId,
          actorRole: "creator",
          action: "voice_asset.uploaded",
          targetType: "VoiceAsset",
          targetId: voice.id,
          after: voice as unknown as Prisma.InputJsonValue,
        },
      });
      return voice;
    });
  } catch (error) {
    await deleteObject(key).catch(() => {});
    throw error;
  }
}

export async function deleteVoiceAsset(input: { projectId: string; voiceId: string; creatorId: string }) {
  const deleted = await prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirstOrThrow({
      where: { id: input.projectId, creatorId: input.creatorId },
    });
    const voice = await tx.voiceAsset.findFirstOrThrow({
      where: { id: input.voiceId, projectId: project.id },
    });
    await tx.voiceAsset.delete({ where: { id: voice.id } });
    await tx.auditLog.create({
      data: {
        actorUserId: input.creatorId,
        actorRole: "creator",
        action: "voice_asset.deleted",
        targetType: "VoiceAsset",
        targetId: voice.id,
        before: voice as unknown as Prisma.InputJsonValue,
      },
    });
    return voice;
  });

  // Best-effort storage cleanup for uploaded (key-style) voices only.
  if (!isStaticVoiceUrl(deleted.audioUrl)) {
    await deleteObject(deleted.audioUrl).catch(() => {});
  }
  return deleted;
}
