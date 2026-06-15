import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createCreatorAccount } from "@/lib/admin";
import { requirePermission } from "@/lib/authz";
import { jsonError, parseBody } from "@/lib/request";

const optionalDateTime = z.preprocess((value) => (value === "" ? undefined : value), z.string().datetime().optional());
const optionalPositiveInt = z.preprocess((value) => (value === "" ? undefined : value), z.number().int().positive().optional());
const optionalNonEmptyString = z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional());

const creatorSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(8),
  displayName: z.string().min(1),
  planName: optionalNonEmptyString,
  expiresAt: optionalDateTime,
  maxProjects: optionalPositiveInt,
  monthlyAiMessageLimit: optionalPositiveInt,
  fanCodeQuota: optionalPositiveInt,
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("creators.manage");
    const body = await parseBody(request, creatorSchema);
    const creator = await createCreatorAccount({
      admin: { id: session.user.id, role: session.user.role },
      username: body.username,
      password: body.password,
      displayName: body.displayName,
      planName: body.planName,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      maxProjects: body.maxProjects,
      monthlyAiMessageLimit: body.monthlyAiMessageLimit,
      fanCodeQuota: body.fanCodeQuota,
    });
    return NextResponse.json({ creator }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Creator creation failed");
  }
}
