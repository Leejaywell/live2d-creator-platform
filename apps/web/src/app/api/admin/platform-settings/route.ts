import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/authz";
import { upsertPlatformSetting } from "@/lib/platform-settings";
import { jsonError, parseBody } from "@/lib/request";

const schema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("provider_secrets.manage");
    const body = await parseBody(request, schema);
    const setting = await upsertPlatformSetting({
      admin: { id: session.user.id, role: session.user.role },
      key: body.key,
      value: body.value,
    });
    return NextResponse.json({ setting });
  } catch (error) {
    return jsonError(error, "Platform setting save failed");
  }
}
