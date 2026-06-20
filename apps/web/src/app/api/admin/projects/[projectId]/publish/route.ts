import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { projectCreatorId } from "@/lib/admin-project";
import { requirePermission } from "@/lib/authz";
import { setProjectStatus } from "@/lib/projects";
import { jsonError, parseBody } from "@/lib/request";

const schema = z.object({ status: z.enum(["draft", "published", "paused"]) });

export async function POST(request: NextRequest, context: RouteContext<"/api/admin/projects/[projectId]/publish">) {
  try {
    const session = await requirePermission("projects.pause");
    const { projectId } = await context.params;
    const creatorId = await projectCreatorId(projectId);
    const body = await parseBody(request, schema);
    const project = await setProjectStatus({
      projectId,
      creatorId,
      actorId: session.user.id,
      actorRole: session.user.role,
      status: body.status,
    });
    return NextResponse.json({ project });
  } catch (error) {
    return jsonError(error, "Project status update failed");
  }
}
