import { NextRequest, NextResponse } from "next/server";
import { ProjectStatus } from "@prisma/client";
import { z } from "zod";

import { requirePermission } from "@/lib/authz";
import { setProjectStatus } from "@/lib/projects";
import { jsonError, parseBody } from "@/lib/request";

const schema = z.object({ status: z.nativeEnum(ProjectStatus) });

export async function POST(request: NextRequest, context: RouteContext<"/api/admin/projects/[projectId]/status">) {
  try {
    const session = await requirePermission("projects.pause");
    const { projectId } = await context.params;
    const body = await parseBody(request, schema);
    const project = await setProjectStatus({
      projectId,
      actorId: session.user.id,
      actorRole: session.user.role,
      status: body.status,
    });
    return NextResponse.json({ project });
  } catch (error) {
    return jsonError(error, "Project status update failed");
  }
}
