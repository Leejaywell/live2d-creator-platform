import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/authz";
import { rateLimit } from "@/lib/rate-limit";
import { jsonError } from "@/lib/request";
import { uploadVoiceAsset } from "@/lib/voice-assets";

const MAX_UPLOAD_BYTES = Number(process.env.MAX_VOICE_BYTES || 12 * 1024 * 1024);

export async function POST(request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]/voices">) {
  try {
    const limited = await rateLimit(request, { key: "voice-upload", limit: 20, windowMs: 60_000 });
    if (limited) return limited;

    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can upload voices" }, { status: 403 });
    }
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_UPLOAD_BYTES + 500_000) {
      return NextResponse.json({ error: "File is too large" }, { status: 413 });
    }
    const { projectId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");
    const name = String(formData.get("name") ?? "").slice(0, 100);
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is too large" }, { status: 413 });
    }
    const voice = await uploadVoiceAsset({
      projectId,
      creatorId: session.user.id,
      name,
      fileName: file.name,
      data: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json({ voice }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Voice upload failed");
  }
}
