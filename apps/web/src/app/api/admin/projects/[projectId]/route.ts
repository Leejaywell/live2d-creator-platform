import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/authz";
import { deleteProject } from "@/lib/projects";
import { jsonError } from "@/lib/request";

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/admin/projects/[projectId]">) {
  try {
    const session = await requirePermission("projects.pause");
    const { projectId } = await context.params;
    const project = await deleteProject({
      projectId,
      actorId: session.user.id,
      actorRole: session.user.role,
    });
    return NextResponse.json({ project });
  } catch (error) {
    return jsonError(error, "Project deletion failed");
  }
}
