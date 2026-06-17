import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/authz";
import { generateFanCodeBatch } from "@/lib/fan-code-service";
import { jsonError, parseBody } from "@/lib/request";

const requestSchema = z.object({
  projectId: z.string().min(1),
  quantity: z.number().int().min(1).max(500),
  expiresAt: z.string().datetime(),
  maxMessages: z.number().int().min(1).max(10000),
  bindMode: z.enum(["none", "browserDevice"]),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can generate project fan codes" }, { status: 403 });
    }

    const body = await parseBody(request, requestSchema);
    const codes = await generateFanCodeBatch({
      projectId: body.projectId,
      creatorId: session.user.id,
      quantity: body.quantity,
      expiresAt: new Date(body.expiresAt),
      maxMessages: body.maxMessages,
      bindMode: body.bindMode,
    });
    return NextResponse.json({ codes });
  } catch (error) {
    return jsonError(error, "Fan code generation failed");
  }
}
