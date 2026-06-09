import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/authz";
import { disableVoiceAsset, updateVoiceAsset } from "@/lib/projects";
import { jsonError, parseBody } from "@/lib/request";
import { replaceVoiceAssetAudio } from "@/lib/voice-assets";

const tagsSchema = z.union([z.string(), z.array(z.string())]).optional().transform((value) => {
  if (!value) return undefined;
  return Array.isArray(value)
    ? value
    : value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
});
const optionalPositiveInt = z.preprocess((value) => (value === "" ? undefined : value), z.number().int().positive().optional());

const voiceSchema = z.object({
  name: z.string().min(1).optional(),
  durationMs: optionalPositiveInt,
  tags: tagsSchema,
  status: z.enum(["active", "disabled"]).optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]/voice-assets/[voiceAssetId]">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can update voice assets" }, { status: 403 });
    }

    const { projectId, voiceAssetId } = await context.params;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file" }, { status: 400 });
      }
      const tags = String(formData.get("tags") ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const name = String(formData.get("name") ?? "").trim() || undefined;
      const voiceAsset = await replaceVoiceAssetAudio({
        projectId,
        voiceAssetId,
        creatorId: session.user.id,
        name,
        fileName: file.name,
        contentType: file.type,
        data: Buffer.from(await file.arrayBuffer()),
        tags,
      });
      return NextResponse.json({ voiceAsset });
    }

    const body = await parseBody(request, voiceSchema);
    const voiceAsset = await updateVoiceAsset({
      projectId,
      voiceAssetId,
      creatorId: session.user.id,
      ...body,
    });
    return NextResponse.json({ voiceAsset });
  } catch (error) {
    return jsonError(error, "Voice asset update failed");
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]/voice-assets/[voiceAssetId]">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can delete voice assets" }, { status: 403 });
    }

    const { projectId, voiceAssetId } = await context.params;
    const voiceAsset = await disableVoiceAsset({
      projectId,
      voiceAssetId,
      creatorId: session.user.id,
    });
    return NextResponse.json({ voiceAsset });
  } catch (error) {
    return jsonError(error, "Voice asset deletion failed");
  }
}
