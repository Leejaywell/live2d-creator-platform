import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/request";
import { uploadVoiceAsset } from "@/lib/voice-assets";

export async function POST(request: NextRequest, context: RouteContext<"/api/admin/projects/[projectId]/voice-assets">) {
  try {
    const session = await requirePermission("assets.assist");
    const { projectId } = await context.params;
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { creatorId: true },
    });

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const name = String(formData.get("name") ?? file.name.replace(/\.(mp3|wav)$/i, "")).trim() || file.name;
    const tags = String(formData.get("tags") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const voiceAsset = await uploadVoiceAsset({
      projectId,
      creatorId: project.creatorId,
      actorId: session.user.id,
      actorRole: session.user.role,
      name,
      fileName: file.name,
      contentType: file.type,
      data: Buffer.from(await file.arrayBuffer()),
      tags,
    });

    return NextResponse.json({ voiceAsset }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Admin voice upload failed");
  }
}
