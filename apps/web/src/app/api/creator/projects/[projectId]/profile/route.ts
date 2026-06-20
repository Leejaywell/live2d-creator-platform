import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/authz";
import { projectProfileSchema, toUpdateProjectInput } from "@/lib/project-profile-input";
import { updateProject } from "@/lib/projects";
import { jsonError, parseBody } from "@/lib/request";

export async function POST(request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]/profile">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can edit projects" }, { status: 403 });
    }
    const { projectId } = await context.params;
    const body = await parseBody(request, projectProfileSchema);
    const project = await updateProject({ projectId, creatorId: session.user.id, ...toUpdateProjectInput(body) });
    return NextResponse.json({ project });
  } catch (error) {
    return jsonError(error, "Project update failed");
  }
}
