import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/authz";
import { adminUpdateProjectPrompt } from "@/lib/projects";
import { jsonError, parseBody } from "@/lib/request";

const schema = z.object({
  // Blank systemPrompt is treated as "no change" so an admin can't accidentally
  // wipe the AI instruction; characterSetting may be cleared to empty.
  systemPrompt: z.string().optional(),
  characterSetting: z.string().optional(),
});

export async function POST(request: NextRequest, context: RouteContext<"/api/admin/projects/[projectId]/prompt">) {
  try {
    const session = await requirePermission("projects.pause");
    const { projectId } = await context.params;
    const body = await parseBody(request, schema);
    const project = await adminUpdateProjectPrompt({
      projectId,
      actorId: session.user.id,
      actorRole: session.user.role,
      systemPrompt: body.systemPrompt?.trim() ? body.systemPrompt : undefined,
      characterSetting: body.characterSetting ?? undefined,
    });
    return NextResponse.json({ project });
  } catch (error) {
    return jsonError(error, "Project prompt update failed");
  }
}
