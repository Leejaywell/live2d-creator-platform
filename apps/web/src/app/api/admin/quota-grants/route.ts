import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { grantCreatorQuota } from "@/lib/admin";
import { requirePermission } from "@/lib/authz";
import { jsonError, parseBody } from "@/lib/request";

const quotaGrantSchema = z.object({
  creatorId: z.string().min(1),
  resource: z.enum(["projects", "ai_messages", "fan_codes"]),
  amount: z.number().int().positive(),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("quota.grant");
    const body = await parseBody(request, quotaGrantSchema);
    const grant = await grantCreatorQuota({
      admin: { id: session.user.id, role: session.user.role },
      ...body,
    });
    return NextResponse.json({ grant }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Quota grant failed");
  }
}
