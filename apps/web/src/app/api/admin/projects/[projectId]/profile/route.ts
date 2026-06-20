import { NextRequest, NextResponse } from "next/server";

import { projectCreatorId } from "@/lib/admin-project";
import { requirePermission } from "@/lib/authz";
import { projectProfileSchema, toUpdateProjectInput } from "@/lib/project-profile-input";
import { updateProject } from "@/lib/projects";
import { jsonError, parseBody } from "@/lib/request";

export async function POST(request: NextRequest, context: RouteContext<"/api/admin/projects/[projectId]/profile">) {
  try {
    await requirePermission("projects.pause");
    const { projectId } = await context.params;
    const creatorId = await projectCreatorId(projectId);
    const body = await parseBody(request, projectProfileSchema);
    const project = await updateProject({ projectId, creatorId, ...toUpdateProjectInput(body) });
    return NextResponse.json({ project });
  } catch (error) {
    return jsonError(error, "Project update failed");
  }
}
