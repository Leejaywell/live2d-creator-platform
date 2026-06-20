import { NextRequest, NextResponse } from "next/server";

import { projectCreatorId } from "@/lib/admin-project";
import { requirePermission } from "@/lib/authz";
import { jsonError } from "@/lib/request";
import { deleteVoiceAsset } from "@/lib/voice-assets";

export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/admin/projects/[projectId]/voices/[voiceId]">,
) {
  try {
    await requirePermission("assets.assist");
    const { projectId, voiceId } = await context.params;
    const creatorId = await projectCreatorId(projectId);
    await deleteVoiceAsset({ projectId, voiceId, creatorId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "Voice deletion failed");
  }
}
