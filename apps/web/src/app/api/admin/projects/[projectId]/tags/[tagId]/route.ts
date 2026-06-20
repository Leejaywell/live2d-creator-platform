import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { projectCreatorId } from "@/lib/admin-project";
import { requirePermission } from "@/lib/authz";
import { optionalJsonString } from "@/lib/json-field";
import { deleteTriggerTag, updateTriggerTag } from "@/lib/projects";
import { jsonError, parseBody } from "@/lib/request";

const csv = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value : value.split(",").map((item) => item.trim()).filter(Boolean)))
  .pipe(z.array(z.string().max(50)).max(50));

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  keywords: csv.optional(),
  promptFragment: z.string().max(2000).optional(),
  live2dExpression: z.string().max(100).optional(),
  live2dParams: optionalJsonString("live2dParams must be valid JSON"),
  priority: z.coerce.number().int().min(0).max(1000).optional(),
  enabled: z.boolean().optional(),
});

type Ctx = RouteContext<"/api/admin/projects/[projectId]/tags/[tagId]">;

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await requirePermission("assets.assist");
    const { projectId, tagId } = await context.params;
    const creatorId = await projectCreatorId(projectId);
    const body = await parseBody(request, schema);
    const tag = await updateTriggerTag({ tagId, projectId, creatorId, ...body });
    return NextResponse.json({ tag });
  } catch (error) {
    return jsonError(error, "Tag update failed");
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  try {
    await requirePermission("assets.assist");
    const { projectId, tagId } = await context.params;
    const creatorId = await projectCreatorId(projectId);
    await deleteTriggerTag({ tagId, projectId, creatorId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "Tag deletion failed");
  }
}
