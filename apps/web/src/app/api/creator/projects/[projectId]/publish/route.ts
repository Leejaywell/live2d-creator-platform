import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/authz";
import { setProjectStatus } from "@/lib/projects";
import { jsonError, parseBody } from "@/lib/request";

const statusSchema = z.object({
  status: z.enum(["draft", "published", "paused"]),
});

export async function POST(request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]/publish">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can change project status" }, { status: 403 });
    }

    const { projectId } = await context.params;
    const body = await parseBody(request, statusSchema);
    const project = await setProjectStatus({
      projectId,
      creatorId: session.user.id,
      actorId: session.user.id,
      actorRole: session.user.role,
      status: body.status,
    });
    return NextResponse.json({ project });
  } catch (error) {
    return jsonError(error, "Project status update failed");
  }
}
