import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/authz";
import { uploadModelAsset } from "@/lib/model-assets";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/request";

export async function POST(request: NextRequest, context: RouteContext<"/api/admin/projects/[projectId]/model-assets">) {
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
    return jsonError(error, "Admin model upload failed");
  }
}
