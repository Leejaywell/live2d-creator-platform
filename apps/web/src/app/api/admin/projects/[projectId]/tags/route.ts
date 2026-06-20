import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { projectCreatorId } from "@/lib/admin-project";
import { requirePermission } from "@/lib/authz";
import { optionalJsonString } from "@/lib/json-field";
import { createTriggerTag } from "@/lib/projects";
import { jsonError, parseBody } from "@/lib/request";

const csv = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value : value.split(",").map((item) => item.trim()).filter(Boolean)))
  .pipe(z.array(z.string().max(50)).max(50));

const schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  keywords: csv.default([]),
  promptFragment: z.string().max(2000).optional(),
  live2dExpression: z.string().max(100).optional(),
  live2dParams: optionalJsonString("live2dParams must be valid JSON"),
  priority: z.coerce.number().int().min(0).max(1000).default(0),
  enabled: z.boolean().default(true),
  voiceAssetIds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v == null ? [] : Array.isArray(v) ? v : [v]))
    .pipe(z.array(z.string().min(1).max(40)).max(50)),
});

export async function POST(request: NextRequest, context: RouteContext<"/api/admin/projects/[projectId]/tags">) {
  try {
    await requirePermission("assets.assist");
    const { projectId } = await context.params;
    const creatorId = await projectCreatorId(projectId);
    const body = await parseBody(request, schema);
    const tag = await createTriggerTag({ projectId, creatorId, ...body });
    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Tag creation failed");
  }
}
