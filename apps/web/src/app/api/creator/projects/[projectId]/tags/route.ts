import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/authz";
import { optionalJsonString } from "@/lib/json-field";
import { createTriggerTag } from "@/lib/projects";
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
  name: z.string().min(1),
  description: z.string().optional(),
  keywords: csvSchema,
  promptFragment: z.string().optional(),
  live2dExpression: z.string().optional(),
  live2dParams: optionalJsonString("live2dParams must be valid JSON"),
  priority: z.number().int().default(0),
  enabled: z.boolean().default(true),
});

export async function POST(request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]/tags">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can create tags" }, { status: 403 });
    }

    const { projectId } = await context.params;
    const body = await parseBody(request, tagSchema);
    const tag = await createTriggerTag({
      projectId,
      creatorId: session.user.id,
      ...body,
    });
    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Trigger tag creation failed");
  }
}
