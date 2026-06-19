import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/authz";
import { revokeFanAccessCode } from "@/lib/fan-code-service";
import { jsonError } from "@/lib/request";

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/creator/fan-codes/[codeId]">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can revoke fan codes" }, { status: 403 });
    }
    const { codeId } = await context.params;
    const result = await revokeFanAccessCode({
      codeId,
      actor: { id: session.user.id, role: session.user.role },
      creatorId: session.user.id,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return jsonError(error, "Fan code revoke failed");
  }
}
