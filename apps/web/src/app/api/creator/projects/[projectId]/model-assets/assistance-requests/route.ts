import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/authz";
import { createModelSetupAssistanceRequest } from "@/lib/projects";
import { jsonError, parseBody } from "@/lib/request";

const schema = z.object({ notes: z.string().max(2000).optional() });

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/creator/projects/[projectId]/model-assets/assistance-requests">,
) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can request assistance" }, { status: 403 });
    }
    const { projectId } = await context.params;
    const body = await parseBody(request, schema);
    await createModelSetupAssistanceRequest({ projectId, creatorId: session.user.id, notes: body.notes });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Assistance request failed");
  }
}
