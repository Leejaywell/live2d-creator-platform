import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/authz";
import { uploadModelAsset } from "@/lib/model-assets";
import { jsonError } from "@/lib/request";

export async function POST(request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]/model-assets">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can upload model assets" }, { status: 403 });
    }

    const { projectId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const modelAsset = await uploadModelAsset({
      projectId,
      creatorId: session.user.id,
      fileName: file.name,
      data: Buffer.from(await file.arrayBuffer()),
    });

    return NextResponse.json({ modelAsset }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Model upload failed");
  }
}
