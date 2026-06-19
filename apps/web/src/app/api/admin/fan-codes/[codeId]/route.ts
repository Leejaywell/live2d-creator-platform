import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/authz";
import { revokeFanAccessCode } from "@/lib/fan-code-service";
import { jsonError } from "@/lib/request";

// Soft-revoke (停用) a fan code on the creator's behalf. Mirrors the creator action;
// the record and its usage history are kept.
export async function DELETE(_request: NextRequest, context: RouteContext<"/api/admin/fan-codes/[codeId]">) {
  try {
    const session = await requirePermission("fan_codes.manage");
    const { codeId } = await context.params;
    const result = await revokeFanAccessCode({
      codeId,
      actor: { id: session.user.id, role: session.user.role },
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return jsonError(error, "Fan code revoke failed");
  }
}
