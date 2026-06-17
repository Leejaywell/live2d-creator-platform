import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/authz";
import { listPlatformSettings, upsertPlatformSetting } from "@/lib/platform-settings";
import { jsonError, parseBody } from "@/lib/request";

const platformSettingSchema = z.object({
  key: z.string().trim().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export async function GET() {
  try {
    await requirePermission("provider_secrets.manage");
    const settings = await listPlatformSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    return jsonError(error, "Platform settings lookup failed");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("provider_secrets.manage");
    const body = await parseBody(request, platformSettingSchema);
    const setting = await upsertPlatformSetting({
      admin: { id: session.user.id, role: session.user.role },
      key: body.key,
      value: body.value,
    });
    return NextResponse.json({ setting });
  } catch (error) {
    return jsonError(error, "Platform setting update failed");
  }
}
