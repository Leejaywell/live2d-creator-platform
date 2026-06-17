import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/authz";
import { deleteProject, updateProject } from "@/lib/projects";
import { jsonError, parseBody } from "@/lib/request";

const optionalUrl = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().url().nullable().optional(),
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  intro: z.string().optional(),
  avatarUrl: optionalUrl,
  backgroundUrl: optionalUrl,
  systemPrompt: z.string().min(1).optional(),
  welcomeMessage: z.string().min(1).optional(),
  theme: z.string().min(1).optional(),
});

async function requireCreator() {
  const session = await requireSession();
  if (session.user.role !== "creator") {
    throw new Response("Only creators can manage projects", { status: 403 });
  }
  return session;
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]">) {
  try {
    const session = await requireCreator();
    const { projectId } = await context.params;
    const body = await parseBody(request, updateSchema);
    const project = await updateProject({ projectId, creatorId: session.user.id, ...body });
    return NextResponse.json({ project });
  } catch (error) {
    return jsonError(error, "Project update failed");
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]">) {
  try {
    const session = await requireCreator();
    const { projectId } = await context.params;
    await deleteProject({
      projectId,
      creatorId: session.user.id,
      actorId: session.user.id,
      actorRole: session.user.role,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "Project deletion failed");
  }
}
