import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/authz";
import { generateFanCodeBatch } from "@/lib/fan-code-service";
import { jsonError, parseBody } from "@/lib/request";

const schema = z.object({
  projectId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(500),
  expiresAt: z.coerce.date(),
  maxMessages: z.coerce.number().int().min(1),
  bindMode: z.enum(["none", "browserDevice"]).default("browserDevice"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can generate fan codes" }, { status: 403 });
    }
    const body = await parseBody(request, schema);
    const codes = await generateFanCodeBatch({
      projectId: body.projectId,
      creatorId: session.user.id,
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
