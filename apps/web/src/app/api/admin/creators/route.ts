import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createCreatorAccount } from "@/lib/admin";
import { requirePermission } from "@/lib/authz";
import { jsonError, parseBody } from "@/lib/request";

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(8),
  displayName: z.string().min(1),
  planName: z.string().optional(),
  expiresAt: z.coerce.date().optional(),
  maxProjects: z.coerce.number().int().min(1).optional(),
  monthlyAiMessageLimit: z.coerce.number().int().min(1).optional(),
  fanCodeQuota: z.coerce.number().int().min(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("creators.manage");
    const body = await parseBody(request, schema);
    const creator = await createCreatorAccount({
      admin: { id: session.user.id, role: session.user.role },
      ...body,
    });
    return NextResponse.json({ creator }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Creator creation failed");
  }
}
