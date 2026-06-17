import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/authz";
import { optionalJsonString } from "@/lib/json-field";
import { deleteTriggerTag, updateTriggerTag } from "@/lib/projects";
import { jsonError, parseBody } from "@/lib/request";

const csv = z.union([z.string(), z.array(z.string())]).transform((value) =>
  Array.isArray(value) ? value : value.split(",").map((item) => item.trim()).filter(Boolean),
);

const schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  keywords: csv.optional(),
  promptFragment: z.string().optional(),
  live2dExpression: z.string().optional(),
  live2dParams: optionalJsonString("live2dParams must be valid JSON"),
  priority: z.number().int().optional(),
  enabled: z.boolean().optional(),
});

type Ctx = RouteContext<"/api/creator/projects/[projectId]/tags/[tagId]">;

async function requireCreator() {
  const session = await requireSession();
  if (session.user.role !== "creator") {
    throw new Response("Only creators can manage tags", { status: 403 });
  }
  return session;
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const session = await requireCreator();
    const { projectId, tagId } = await context.params;
    const body = await parseBody(request, schema);
    const tag = await updateTriggerTag({ tagId, projectId, creatorId: session.user.id, ...body });
    return NextResponse.json({ tag });
  } catch (error) {
    return jsonError(error, "Tag update failed");
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  try {
    const session = await requireCreator();
    const { projectId, tagId } = await context.params;
    await deleteTriggerTag({ tagId, projectId, creatorId: session.user.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "Tag deletion failed");
  }
}
