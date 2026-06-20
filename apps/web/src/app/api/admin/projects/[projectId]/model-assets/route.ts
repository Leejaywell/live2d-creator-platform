import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/authz";
import { uploadModelAsset } from "@/lib/model-assets";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { jsonError } from "@/lib/request";

const MAX_UPLOAD_BYTES = Number(process.env.MAX_LIVE2D_ZIP_BYTES || 104857600);

export async function POST(request: NextRequest, context: RouteContext<"/api/admin/projects/[projectId]/model-assets">) {
  try {
    const limited = await rateLimit(request, { key: "model-upload", limit: 10, windowMs: 60_000 });
    if (limited) return limited;

    const session = await requirePermission("assets.assist");
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_UPLOAD_BYTES + 1_000_000) {
      return NextResponse.json({ error: "File is too large" }, { status: 413 });
    }
    const { projectId } = await context.params;
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { creatorId: true } });
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is too large" }, { status: 413 });
    }
    const modelAsset = await uploadModelAsset({
      projectId,
      creatorId: project.creatorId,
      actorId: session.user.id,
      actorRole: session.user.role,
      uploadedBy: "admin",
      fileName: file.name,
      data: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json({ modelAsset }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Model upload failed");
  }
}
