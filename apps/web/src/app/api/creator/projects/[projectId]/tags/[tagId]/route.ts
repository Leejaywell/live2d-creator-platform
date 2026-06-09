import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/authz";
import { optionalJsonString } from "@/lib/json-field";
import { deleteTriggerTag, updateTriggerTag } from "@/lib/projects";
import { jsonError, parseBody } from "@/lib/request";

const csvSchema = z.union([z.string(), z.array(z.string())]).transform((value) =>
  Array.isArray(value)
    ? value
    : value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
);

const tagSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  keywords: csvSchema.optional(),
  promptFragment: z.string().optional(),
  live2dExpression: z.string().optional(),
  live2dParams: optionalJsonString("live2dParams must be valid JSON"),
  priority: z.number().int().optional(),
  enabled: z.boolean().optional(),
  voiceAssetIds: csvSchema.optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]/tags/[tagId]">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can update tags" }, { status: 403 });
    }

    const { projectId, tagId } = await context.params;
    const body = await parseBody(request, tagSchema);
    const tag = await updateTriggerTag({
      projectId,
      tagId,
      creatorId: session.user.id,
      ...body,
    });
    return NextResponse.json({ tag });
  } catch (error) {
    return jsonError(error, "Trigger tag update failed");
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]/tags/[tagId]">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can delete tags" }, { status: 403 });
    }

    const { projectId, tagId } = await context.params;
    const tag = await deleteTriggerTag({
      projectId,
      tagId,
      creatorId: session.user.id,
    });
    return NextResponse.json({ tag });
  } catch (error) {
    return jsonError(error, "Trigger tag deletion failed");
  }
}
