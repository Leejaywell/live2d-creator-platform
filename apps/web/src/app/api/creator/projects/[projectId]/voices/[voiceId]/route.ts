import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/authz";
import { jsonError } from "@/lib/request";
import { deleteVoiceAsset } from "@/lib/voice-assets";

export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/creator/projects/[projectId]/voices/[voiceId]">,
) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can delete voices" }, { status: 403 });
    }
    const { projectId, voiceId } = await context.params;
    await deleteVoiceAsset({ projectId, voiceId, creatorId: session.user.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "Voice deletion failed");
  }
}
