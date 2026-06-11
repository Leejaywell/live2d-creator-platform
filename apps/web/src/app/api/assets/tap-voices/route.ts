import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// Returns the active voice assets for the viewer session's project as
// app-proxy URLs, so the Live2D viewer can play a voice when the model is
// tapped. Access to the underlying audio is still authorized per-request by
// /api/assets/proxy using the same viewerSessionId.
export async function GET(request: NextRequest) {
  const viewerSessionId = request.nextUrl.searchParams.get("viewerSessionId");
  if (!viewerSessionId) {
    return NextResponse.json({ error: "Missing viewerSessionId" }, { status: 400 });
  }

  const viewerSession = await prisma.viewerSession.findUnique({
    where: { id: viewerSessionId },
    include: {
      fanAccessCode: { select: { status: true, expiresAt: true } },
      project: {
        select: {
          status: true,
          voiceAssets: {
            where: { status: "active" },
            select: { id: true, name: true, audioUrl: true },
          },
        },
      },
    },
  });

  if (!viewerSession || viewerSession.project.status !== "published") {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const code = viewerSession.fanAccessCode;
  if (code.status !== "active" || code.expiresAt <= new Date()) {
    return NextResponse.json({ error: "Access code is expired or revoked" }, { status: 403 });
  }

  const voices = viewerSession.project.voiceAssets.map((voice) => {
    const params = new URLSearchParams({ key: voice.audioUrl, viewerSessionId });
    return {
      id: voice.id,
      name: voice.name,
      url: `/api/assets/proxy?${params.toString()}`,
    };
  });

  return NextResponse.json({ voices });
}
