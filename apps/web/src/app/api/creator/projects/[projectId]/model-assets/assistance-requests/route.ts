import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/authz";
import { createModelSetupAssistanceRequest } from "@/lib/projects";
import { jsonError, parseBody } from "@/lib/request";

const assistanceRequestSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});

export async function POST(request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]/model-assets/assistance-requests">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can request model setup assistance" }, { status: 403 });
    }

    const { projectId } = await context.params;
    const requestLog = await createModelSetupAssistanceRequest({
      projectId,
      creatorId: session.user.id,
      ...(await parseBody(request, assistanceRequestSchema)),
    });

    return NextResponse.json({ request: requestLog }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Model setup assistance request failed");
  }
}
