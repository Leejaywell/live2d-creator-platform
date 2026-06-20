import { NextRequest, NextResponse } from "next/server";
import { QuotaResource } from "@prisma/client";
import { z } from "zod";

import { grantCreatorQuota } from "@/lib/admin";
import { requirePermission } from "@/lib/authz";
import { jsonError, parseBody } from "@/lib/request";

const schema = z.object({
  creatorId: z.string().min(1),
  resource: z.nativeEnum(QuotaResource),
  amount: z.coerce.number().int().min(1).max(10000000),
  reason: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("quota.grant");
    const body = await parseBody(request, schema);
    const ledger = await grantCreatorQuota({
      admin: { id: session.user.id, role: session.user.role },
      ...body,
    });
    return NextResponse.json({ ledger }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Quota grant failed");
  }
}
