import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/authz";
import { jsonError } from "@/lib/request";
import { uploadVoiceAsset } from "@/lib/voice-assets";

export async function POST(request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]/voice-assets">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can create voice assets" }, { status: 403 });
    }

    const { projectId } = await context.params;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file" }, { status: 400 });
      }
      const name = String(formData.get("name") ?? file.name.replace(/\.(mp3|wav)$/i, ""));
      const tags = String(formData.get("tags") ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const voiceAsset = await uploadVoiceAsset({
        projectId,
        creatorId: session.user.id,
        name,
        fileName: file.name,
        contentType: file.type,
        data: Buffer.from(await file.arrayBuffer()),
        tags,
      });
      return NextResponse.json({ voiceAsset }, { status: 201 });
    }

    return NextResponse.json({ error: "Voice assets must be uploaded as WAV or MP3 files" }, { status: 415 });
  } catch (error) {
    return jsonError(error, "Voice asset creation failed");
  }
}
