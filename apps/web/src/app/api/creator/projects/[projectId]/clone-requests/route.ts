import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/authz";
import { createVoiceCloneRequest } from "@/lib/projects";
import { jsonError, parseBody } from "@/lib/request";

const cloneRequestSchema = z.object({
  authorizationConfirmed: z.literal(true),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]/clone-requests">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can request voice cloning" }, { status: 403 });
    }

    const { projectId } = await context.params;
    const body = await parseBody(request, cloneRequestSchema);
    const cloneRequest = await createVoiceCloneRequest({
      projectId,
      creatorId: session.user.id,
      ...body,
    });
    return NextResponse.json({ cloneRequest }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Voice clone request failed");
  }
}
