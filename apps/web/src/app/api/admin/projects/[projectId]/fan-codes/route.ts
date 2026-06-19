import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/authz";
import { generateFanCodeBatch } from "@/lib/fan-code-service";
import { prisma } from "@/lib/prisma";
import { jsonError, parseBody } from "@/lib/request";

const schema = z.object({
  quantity: z.coerce.number().int().min(1).max(500),
  expiresAt: z.coerce.date(),
  maxMessages: z.coerce.number().int().min(1),
  bindMode: z.enum(["none", "browserDevice"]).default("browserDevice"),
});

// Admins generate fan codes on a creator's behalf. The codes (and quota usage)
// belong to the project's creator; the project id comes from the route.
export async function POST(request: NextRequest, context: RouteContext<"/api/admin/projects/[projectId]/fan-codes">) {
  try {
    await requirePermission("fan_codes.manage");
    const { projectId } = await context.params;
    const body = await parseBody(request, schema);
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { creatorId: true },
    });
    const codes = await generateFanCodeBatch({
      projectId,
      creatorId: project.creatorId,
      quantity: body.quantity,
      expiresAt: body.expiresAt,
      maxMessages: body.maxMessages,
      bindMode: body.bindMode,
    });
    return NextResponse.json({ codes }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Fan code generation failed");
  }
}
