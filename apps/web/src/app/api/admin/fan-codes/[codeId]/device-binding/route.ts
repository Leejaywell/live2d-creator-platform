import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/authz";
import { resetFanAccessCodeDeviceBinding } from "@/lib/fan-code-service";
import { jsonError } from "@/lib/request";

export async function POST(_request: NextRequest, context: RouteContext<"/api/admin/fan-codes/[codeId]/device-binding">) {
  try {
    const session = await requirePermission("fan_codes.manage");
    const { codeId } = await context.params;
    const result = await resetFanAccessCodeDeviceBinding({
      codeId,
      actor: { id: session.user.id, role: session.user.role },
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return jsonError(error, "Device binding reset failed");
  }
}
