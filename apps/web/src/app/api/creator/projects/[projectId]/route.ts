import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/authz";
import { normalizeProjectSlug } from "@/lib/project-slugs";
import { deleteProject, updateProject } from "@/lib/projects";
import { jsonError, parseBody } from "@/lib/request";

const optionalUrl = z.preprocess((value) => (value === "" ? null : value), z.string().url().nullable().optional());

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).transform(normalizeProjectSlug).pipe(z.string().min(1).regex(/^[a-z0-9-]+$/)).optional(),
  intro: z.string().optional(),
  avatarUrl: optionalUrl,
  backgroundUrl: optionalUrl,
  systemPrompt: z.string().min(1).optional(),
  welcomeMessage: z.string().min(1).optional(),
  theme: z.string().min(1).optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can update projects" }, { status: 403 });
    }

    const { projectId } = await context.params;
    const body = await parseBody(request, updateProjectSchema);
    const project = await updateProject({
      projectId,
      creatorId: session.user.id,
      ...body,
    });
    return NextResponse.json({ project });
  } catch (error) {
    return jsonError(error, "Project update failed");
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can delete projects" }, { status: 403 });
    }
    const { projectId } = await context.params;
    const project = await deleteProject({
      projectId,
      actorId: session.user.id,
      actorRole: session.user.role,
      creatorId: session.user.id,
    });
    return NextResponse.json({ project });
  } catch (error) {
    return jsonError(error, "Project deletion failed");
  }
}
