import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupportNote } from "@/lib/admin";
import { requirePermission } from "@/lib/authz";
import { jsonError, parseBody } from "@/lib/request";

const schema = z.object({
  targetType: z.string().min(1).max(64),
  targetId: z.string().max(64).optional(),
  note: z.string().min(1).max(2000),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("support.notes");
    const body = await parseBody(request, schema);
    const note = await createSupportNote({
      admin: { id: session.user.id, role: session.user.role },
      targetType: body.targetType,
      targetId: body.targetId,
      note: body.note,
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Support note failed");
  }
}
